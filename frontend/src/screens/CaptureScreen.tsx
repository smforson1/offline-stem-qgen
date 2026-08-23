// Owner: S3 | Purpose: VisionCamera screen — captures textbook photo and triggers OCR pipeline

import React, { useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  Camera, CameraRef, useCameraDevice, useCameraPermission, usePhotoOutput,
} from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { RootStackParamList } from '../types/Navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSessionStore } from '../store/useSessionStore';
import { recognizeText } from '../api/ocrService';
import { generateQuestionsStream } from '../api/generateApi';
import { sessionRepository } from '../db/sessionRepository';
import { questionRepository } from '../db/questionRepository';
import { ocrCacheRepository } from '../db/ocrCacheRepository';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { StreamingProgressOverlay, StreamStage } from '../components/StreamingProgressOverlay';
import { Colors, Fonts } from '../theme/colors';
import { CameraOff, Lock, Ban, Image as ImageIcon, Clock, SlidersHorizontal } from 'lucide-react-native';

type CaptureScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Capture'>;

const CORNER_SIZE = 22;
const CORNER_THICK = 3;

export const CaptureScreen: React.FC = () => {
  const navigation = useNavigation<CaptureScreenNavigationProp>();
  const cameraRef = useRef<CameraRef>(null);

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const photoOutput = usePhotoOutput();

  const settings = useSettingsStore();
  const sessionStore = useSessionStore();

  const [loading, setLoading] = useState(false);
  const [streamStage, setStreamStage] = useState<StreamStage>('ocr');
  const [questionsDone, setQuestionsDone] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [recentScans, setRecentScans] = useState<import('../db/ocrCacheRepository').OcrCacheEntry[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setPermissionDenied(false);
      ocrCacheRepository.getAll().then(setRecentScans).catch(() => {});
    }, [])
  );

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (!granted) setPermissionDenied(true);
  };

  const openAppSettings = () => {
    if (Platform.OS === 'android') Linking.openSettings();
    else Linking.openURL('app-settings:');
  };

  const processTextbookText = async (text: string) => {
    try {
      setLoading(true);
      setStreamStage('generating');
      setQuestionsDone(0);

      const numQuestions = settings.defaultQuestionCount ?? 5;

      await generateQuestionsStream(
        text,
        settings.defaultSubject,
        settings.defaultDifficulty,
        settings.defaultQuestionType,
        numQuestions,
        // onProgress — update questions counter as each question arrives via SSE
        ({ question_index }) => {
          setQuestionsDone(question_index);
        },
        // onDone — full list received, save and navigate
        async ({ session_id, questions }) => {
          try {
            setStreamStage('saving');
            const newSession = {
              id: session_id,
              subject: settings.defaultSubject,
              difficulty: settings.defaultDifficulty,
              raw_context: text,
              created_at: new Date().toISOString(),
            };
            // Save session first (foreign key requirement), then all questions
            await sessionRepository.saveSession(newSession);
            await questionRepository.saveQuestions(questions, session_id);
            // Start session store AFTER DB writes complete
            sessionStore.startSession(newSession, questions);
            setLoading(false);
            // Navigate — QuestionScreen will reload from DB to ensure all questions are present
            navigation.replace('Question', { sessionId: session_id });
          } catch (e: any) {
            setLoading(false);
            alert(`Failed to save session: ${e.message}`);
          }
        },
        // onError
        (message) => {
          setLoading(false);
          alert(`Generation failed: ${message}`);
        },
      );
    } catch (e: any) {
      setLoading(false);
      alert(`Generation failed: ${e.message || 'Check your local server connection.'}`);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    try {
      setLoading(true);
      setStreamStage('ocr');
      setQuestionsDone(0);
      const snapshot = await cameraRef.current.takeSnapshot();
      const tempPath = await snapshot.saveToTemporaryFileAsync('jpg', 90);
      const ocrRes = await recognizeText(`file://${tempPath}`);
      if (!ocrRes.success || !ocrRes.full_text) throw new Error(ocrRes.error || 'Failed to extract text.');
      // Cache OCR result for offline regeneration
      await ocrCacheRepository.save({
        id: String(Math.abs(tempPath.split('').reduce((h: number, c: string) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0))),
        uri_hint: tempPath.slice(-40),
        full_text: ocrRes.full_text,
        subject: settings.defaultSubject,
        cached_at: new Date().toISOString(),
      });
      await processTextbookText(ocrRes.full_text);
    } catch (e: any) {
      setLoading(false);
      alert(`Capture failed: ${e.message}`);
    }
  };

  const handleMockCapture = async () => {
    const mockTexts: Record<string, string> = {
      Physics: "Newton's Second Law of Motion states that the acceleration of an object as produced by a net force is directly proportional to the magnitude of the net force, in the same direction as the net force, and inversely proportional to the mass of the object. F = m * a where F is Net Force, m is mass and a is acceleration. The unit of force is the Newton (N). When multiple forces act on an object, the net force is the vector sum of all individual forces.",
      Chemistry: "Atoms combine in simple whole-number ratios to form compounds, as stated by the Law of Definite Proportions. The periodic table organises elements by atomic number and electron configuration. Ionic bonds form when electrons are transferred between atoms, while covalent bonds involve the sharing of electrons. The molar mass of a substance is the mass of one mole (6.022 × 10²³ particles) of that substance.",
      Biology: "Cells are the basic structural and functional units of all living organisms. The cell theory states that all organisms are composed of cells, the cell is the basic unit of life, and all cells arise from pre-existing cells. DNA carries genetic information in sequences of nucleotide bases. Photosynthesis occurs in chloroplasts where light energy is converted into chemical energy stored in glucose: 6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂.",
      Mathematics: "A quadratic equation is a polynomial equation of degree 2 in the form ax² + bx + c = 0, where a ≠ 0. The quadratic formula x = (-b ± √(b²-4ac)) / 2a gives the roots of the equation. The discriminant b²-4ac determines the nature of roots: positive gives two real roots, zero gives one repeated root, negative gives complex roots. The parabola y = ax² + bx + c opens upward when a > 0 and downward when a < 0.",
      STEM: "Newton's Second Law of Motion states that the acceleration of an object as produced by a net force is directly proportional to the magnitude of the net force, in the same direction as the net force, and inversely proportional to the mass of the object. F = m * a where F is Net Force, m is mass and a is acceleration.",
    };
    const text = mockTexts[settings.defaultSubject] || mockTexts['STEM'];
    await processTextbookText(text);
  };

  const handlePickFromGallery = async () => {
    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Gallery access was denied. Please enable it in your device settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets || result.assets.length === 0) return;
    const uri = result.assets[0].uri;
    try {
      setLoading(true);
      setStreamStage('ocr');
      setQuestionsDone(0);
      const ocrRes = await recognizeText(uri);
      if (!ocrRes.success || !ocrRes.full_text) throw new Error(ocrRes.error || 'Failed to extract text.');
      // Cache OCR result for offline regeneration
      await ocrCacheRepository.save({
        id: String(Math.abs(uri.split('').reduce((h: number, c: string) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0))),
        uri_hint: uri.slice(-40),
        full_text: ocrRes.full_text,
        subject: settings.defaultSubject,
        cached_at: new Date().toISOString(),
      });
      await processTextbookText(ocrRes.full_text);
    } catch (e: any) {
      setLoading(false);
      alert(`Upload failed: ${e.message}`);
    }
  };

  // Reusable "Recent Scans" panel — shown when the user taps the Recent button
  const RecentScansPanel = () => (
    <View style={styles.recentPanel}>
      <View style={styles.recentHeader}>
        <Clock size={14} color={Colors.primary} />
        <Text style={styles.recentTitle}>Recent Scans</Text>
        <TouchableOpacity onPress={() => setShowRecent(false)} style={{ marginLeft: 'auto' }}>
          <Text style={styles.recentClose}>✕</Text>
        </TouchableOpacity>
      </View>
      {recentScans.length === 0 ? (
        <Text style={styles.recentEmpty}>No cached scans yet.</Text>
      ) : (
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          {recentScans.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.recentItem}
              activeOpacity={0.75}
              onPress={() => { setShowRecent(false); processTextbookText(entry.full_text); }}
            >
              <View style={styles.recentItemBody}>
                <Text style={styles.recentItemSubject}>{entry.subject}</Text>
                <Text style={styles.recentItemText} numberOfLines={2}>{entry.full_text}</Text>
                <Text style={styles.recentItemDate}>
                  {new Date(entry.cached_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Quiz config bottom sheet
  const QuizConfigPanel = () => (
    <Modal visible={showQuizConfig} transparent animationType="slide" onRequestClose={() => setShowQuizConfig(false)}>
      <TouchableOpacity style={styles.configBackdrop} activeOpacity={1} onPress={() => setShowQuizConfig(false)} />
      <View style={styles.configSheet}>
        <View style={styles.configHandle} />
        <Text style={styles.configTitle}>Quiz Settings</Text>
        <Text style={styles.configLabel}>SUBJECT</Text>
        <View style={styles.configChipRow}>
          {['Physics','Chemistry','Biology','Mathematics'].map((s) => (
            <TouchableOpacity key={s} onPress={() => settings.setDefaultSubject(s)} activeOpacity={0.75}
              style={[styles.configChip, settings.defaultSubject === s && styles.configChipActive]}>
              <Text style={[styles.configChipText, settings.defaultSubject === s && styles.configChipTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.configLabel}>DIFFICULTY</Text>
        <View style={styles.configChipRow}>
          {['Easy','Medium','Hard'].map((d) => (
            <TouchableOpacity key={d} onPress={() => settings.setDefaultDifficulty(d)} activeOpacity={0.75}
              style={[styles.configChip, settings.defaultDifficulty === d && styles.configChipActive]}>
              <Text style={[styles.configChipText, settings.defaultDifficulty === d && styles.configChipTextActive]}>{d}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.configLabel}>FORMAT</Text>
        <View style={styles.configChipRow}>
          {[{label:'Multiple Choice',value:'mcq'},{label:'Short Answer',value:'short_answer'}].map((f) => (
            <TouchableOpacity key={f.value} onPress={() => settings.setDefaultQuestionType(f.value as any)} activeOpacity={0.75}
              style={[styles.configChip, settings.defaultQuestionType === f.value && styles.configChipActive]}>
              <Text style={[styles.configChipText, settings.defaultQuestionType === f.value && styles.configChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.configLabel}>QUESTION COUNT</Text>
        <View style={styles.configChipRow}>
          {[3,5,10].map((n) => (
            <TouchableOpacity key={n} onPress={() => settings.setDefaultQuestionCount(n)} activeOpacity={0.75}
              style={[styles.configChip, settings.defaultQuestionCount === n && styles.configChipActive]}>
              <Text style={[styles.configChipText, settings.defaultQuestionCount === n && styles.configChipTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.configDoneBtn} onPress={() => setShowQuizConfig(false)} activeOpacity={0.85}>
          <Text style={styles.configDoneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );

  // ── No camera device ──────────────────────────────────────────────────────
  if (!device) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Capture</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={styles.centeredBody}>
          <View style={styles.infoCard}>
            <View style={[styles.iconWrap, { backgroundColor: Colors.primarySoft }]}>
              <CameraOff size={40} color={Colors.primary} />
            </View>
            <Text style={styles.cardTitle}>No Camera Detected</Text>
            <Text style={styles.cardDesc}>
              No physical camera found. Use mock scan to test the full question-generation pipeline.
            </Text>
            <TouchableOpacity onPress={handleMockCapture} activeOpacity={0.85} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Simulate Textbook Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickFromGallery} activeOpacity={0.85} style={styles.secondaryBtn}>
              <ImageIcon size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>Upload from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuizConfig(true)} activeOpacity={0.75} style={styles.secondaryBtn}>
              <SlidersHorizontal size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>{settings.defaultSubject} · {settings.defaultQuestionCount}Q · {settings.defaultDifficulty}</Text>
            </TouchableOpacity>
            {recentScans.length > 0 && (
              <TouchableOpacity onPress={() => setShowRecent((v) => !v)} activeOpacity={0.75} style={styles.ghostBtn}>
                <Clock size={14} color={Colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.ghostBtnText}>Recent Scans ({recentScans.length})</Text>
              </TouchableOpacity>
            )}
            {showRecent && <RecentScansPanel />}
            <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.75} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        <StreamingProgressOverlay
          visible={loading}
          stage={streamStage}
          questionsDone={questionsDone}
          questionsTotal={settings.defaultQuestionCount ?? 5}
        />
      </SafeAreaView>
    );
  }

  // ── Permission not granted ────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Camera Access</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={styles.centeredBody}>
          <View style={styles.infoCard}>
            <View style={[styles.iconWrap, { backgroundColor: permissionDenied ? Colors.errorSoft : Colors.primarySoft }]}>
              {permissionDenied ? <Ban size={40} color={Colors.error} /> : <Lock size={40} color={Colors.primary} />}
            </View>
            <Text style={styles.cardTitle}>
              {permissionDenied ? 'Permission Denied' : 'Camera Permission Required'}
            </Text>
            <Text style={styles.cardDesc}>
              {permissionDenied
                ? 'Camera access was denied. Open your device Settings and enable the Camera permission for STEM QGen, then come back.'
                : 'STEM QGen needs access to your camera to scan textbook pages and generate AI-powered quiz questions.'}
            </Text>
            {!permissionDenied ? (
              <TouchableOpacity onPress={handleRequestPermission} activeOpacity={0.85} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Grant Camera Permission</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={openAppSettings} activeOpacity={0.85} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Open App Settings</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleMockCapture} activeOpacity={0.75} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Continue with Mock Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handlePickFromGallery} activeOpacity={0.75} style={styles.secondaryBtn}>
              <ImageIcon size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>Upload from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQuizConfig(true)} activeOpacity={0.75} style={styles.secondaryBtn}>
              <SlidersHorizontal size={16} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryBtnText}>{settings.defaultSubject} · {settings.defaultQuestionCount}Q · {settings.defaultDifficulty}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
        <StreamingProgressOverlay
          visible={loading}
          stage={streamStage}
          questionsDone={questionsDone}
          questionsTotal={settings.defaultQuestionCount ?? 5}
        />
      </SafeAreaView>
    );
  }

  // ── Live camera viewfinder ────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: '#000' }]} edges={[]}>
      <View style={{ flex: 1 }}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!loading}
          outputs={[photoOutput]}
        />
        <View style={styles.hudTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hudBackBtn}>
            <Text style={styles.hudBackText}>← Quit</Text>
          </TouchableOpacity>
          <Text style={styles.hudLabel}>ALIGN TEXT IN FRAME</Text>
          <View style={{ width: 64 }} />
        </View>
        <View style={styles.framingGuide}>
          <View style={styles.framingBorder} />
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <View style={styles.hudBottom}>
          <TouchableOpacity onPress={handleMockCapture} style={styles.simulateBtn}>
            <Text style={styles.simulateBtnText}>Simulate</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCapture} disabled={loading} activeOpacity={0.85} style={styles.shutter}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickFromGallery} style={styles.galleryBtn}>
            <ImageIcon size={22} color="#fff" />
            <Text style={styles.galleryBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
        {/* Quiz config floating button */}
        <TouchableOpacity onPress={() => setShowQuizConfig(true)} style={styles.configFloatBtn} activeOpacity={0.85}>
          <SlidersHorizontal size={14} color="#fff" />
          <Text style={styles.configFloatBtnText}>{settings.defaultSubject} · {settings.defaultQuestionCount}Q</Text>
        </TouchableOpacity>
        <QuizConfigPanel />
        {showRecent && (
          <View style={{ position: 'absolute', bottom: 110, left: 16, right: 16, zIndex: 20 }}>
            <RecentScansPanel />
          </View>
        )}
        {recentScans.length > 0 && !showRecent && (
          <TouchableOpacity
            onPress={() => setShowRecent(true)}
            style={styles.recentHudBtn}
          >
            <Clock size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.recentHudBtnText}>Recent ({recentScans.length})</Text>
          </TouchableOpacity>
        )}
      </View>
      <StreamingProgressOverlay
        visible={loading}
        stage={streamStage}
        questionsDone={questionsDone}
        questionsTotal={settings.defaultQuestionCount ?? 5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },

  // Top bar
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.surface },
  backBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },

  // Centered body
  centeredBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 },
  infoCard: { backgroundColor: Colors.card, borderRadius: 24, padding: 28, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  iconWrap: { width: 88, height: 88, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  cardTitle: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.textPrimary, marginBottom: 10, textAlign: 'center' },
  cardDesc: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },

  // Buttons
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  primaryBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textWhite },
  secondaryBtn: { backgroundColor: Colors.primarySoft, borderRadius: 14, paddingVertical: 13, width: '100%', alignItems: 'center', marginBottom: 10, borderWidth: 1.5, borderColor: Colors.border },
  secondaryBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  ghostBtn: { paddingVertical: 11, width: '100%', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: Colors.border },
  ghostBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textMuted },

  // Camera HUD
  hudTop: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10 },
  hudBackBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  hudBackText: { color: '#fff', fontSize: 13, fontFamily: Fonts.semiBold },
  hudLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: Fonts.bold, letterSpacing: 1.2, textTransform: 'uppercase' },

  // Framing guide
  framingGuide: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  framingBorder: { width: '82%', height: '52%', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderStyle: 'dashed' },
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: Colors.primary },
  cornerTL: { top: '24%', left: '9%', borderTopWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderTopLeftRadius: 4 },
  cornerTR: { top: '24%', right: '9%', borderTopWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderTopRightRadius: 4 },
  cornerBL: { bottom: '24%', left: '9%', borderBottomWidth: CORNER_THICK, borderLeftWidth: CORNER_THICK, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: '24%', right: '9%', borderBottomWidth: CORNER_THICK, borderRightWidth: CORNER_THICK, borderBottomRightRadius: 4 },

  // Bottom HUD
  hudBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 24, paddingVertical: 28, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 10 },
  simulateBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  simulateBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontFamily: Fonts.semiBold },
  galleryBtn: { alignItems: 'center', justifyContent: 'center', width: 72, gap: 4 },
  galleryBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontFamily: Fonts.semiBold },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary },
  recentHudBtn: { position: 'absolute', bottom: 106, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, zIndex: 10 },
  recentHudBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontFamily: Fonts.semiBold },
  recentPanel: { backgroundColor: Colors.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 12, elevation: 6, marginTop: 12 },
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  recentTitle: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textPrimary },
  recentClose: { fontSize: 14, color: Colors.textMuted, paddingHorizontal: 4 },
  recentEmpty: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', paddingVertical: 8 },
  recentItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  recentItemBody: { gap: 2 },
  recentItemSubject: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.3 },
  recentItemText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textPrimary, lineHeight: 18 },
  recentItemDate: { fontSize: 10, fontFamily: Fonts.regular, color: Colors.textLight },

  // Quiz config bottom sheet
  configBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  configSheet: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  configHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 18 },
  configTitle: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.textPrimary, marginBottom: 20 },
  configLabel: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },
  configChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  configChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  configChipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  configChipText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textMuted },
  configChipTextActive: { fontFamily: Fonts.bold, color: Colors.primary },
  configDoneBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginTop: 4, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  configDoneBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textWhite },
  configFloatBtn: { position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, zIndex: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  configFloatBtnText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontFamily: Fonts.semiBold },
});
