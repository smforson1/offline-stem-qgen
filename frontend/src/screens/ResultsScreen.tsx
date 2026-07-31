// Owner: S3 | Purpose: Shows score, correct answers, and export-to-PDF button

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { questionRepository } from '../db/questionRepository';
import { sessionRepository } from '../db/sessionRepository';
import { downloadPdfExport } from '../api/exportApi';
import { Question } from '../types/Question';
import { Session } from '../types/Session';
import { QuestionCard } from '../components/QuestionCard';
import { Colors, Fonts } from '../theme/colors';
import { Trophy, ThumbsUp, BookOpen, FileText, ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react-native';

type ResultsScreenRouteProp = RouteProp<RootStackParamList, 'Results'>;
type ResultsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Results'>;

export const ResultsScreen: React.FC = () => {
  const navigation = useNavigation<ResultsScreenNavigationProp>();
  const route = useRoute<ResultsScreenRouteProp>();
  const { sessionId, score, total } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [studentAnswers, setStudentAnswers] = useState<Record<string, { selectedAnswer: string; isCorrect: boolean }>>({});
  const [pdfLoading, setPdfLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { loadSessionDetails(); }, [sessionId]);

  const loadSessionDetails = async () => {
    try {
      const sess = await sessionRepository.getSessionById(sessionId);
      const qList = await questionRepository.getQuestionsBySession(sessionId);
      const ansList = await questionRepository.getStudentAnswersBySession(sessionId);
      setSession(sess); setQuestions(qList); setStudentAnswers(ansList);
    } catch (e) { console.error('Failed to load results:', e); }
  };

  const handleExportPdf = async () => {
    if (pdfLoading) return;
    try {
      setPdfLoading(true);
      const path = await downloadPdfExport(sessionId, session?.subject || 'STEM');
      setPdfLoading(false);
      await Share.share({ url: `file://${path}`, title: `${session?.subject || 'STEM'} Worksheet` });
    } catch (e: any) {
      setPdfLoading(false);
      alert(`PDF export failed: ${e.message || 'Check server connection.'}`);
    }
  };

  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
  const tier = percentage >= 80
    ? { label: 'Mastery Achieved', color: Colors.success, soft: Colors.successSoft, icon: Trophy }
    : percentage >= 50
    ? { label: 'Competent Effort', color: Colors.primary, soft: Colors.primarySoft, icon: ThumbsUp }
    : { label: 'Needs More Practice', color: Colors.error, soft: Colors.errorSoft, icon: BookOpen };

  const goToPrev = () => {
    const next = Math.max(0, currentIndex - 1);
    setCurrentIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const goToNext = () => {
    const next = Math.min(questions.length - 1, currentIndex + 1);
    setCurrentIndex(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Performance Report</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.homeBtn}>
          <Text style={styles.homeBtnText}>Dashboard</Text>
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Score hero card */}
        <View style={[styles.scoreCard, { borderColor: tier.color + '33', backgroundColor: tier.soft }]}>
          <View style={[styles.scoreBadge, { backgroundColor: tier.color }]}>
            <tier.icon size={32} color="#FFFFFF" />
          </View>
          <Text style={[styles.tierLabel, { color: tier.color }]}>{tier.label}</Text>
          <View style={styles.scoreFractionRow}>
            <Text style={[styles.scoreNumber, { color: tier.color }]}>{score}</Text>
            <Text style={styles.scoreDivider}> / {total}</Text>
          </View>
          <Text style={styles.scorePercent}>{percentage}%</Text>
          <View style={styles.scoreBarTrack}>
            <View style={[styles.scoreBarFill, { width: `${percentage}%`, backgroundColor: tier.color }]} />
          </View>
          <View style={styles.scoreStatRow}>
            <View style={styles.scoreStat}>
              <Text style={[styles.scoreStatValue, { color: Colors.success }]}>{score}</Text>
              <Text style={styles.scoreStatLabel}>Correct</Text>
            </View>
            <View style={styles.scoreStatDivider} />
            <View style={styles.scoreStat}>
              <Text style={[styles.scoreStatValue, { color: Colors.error }]}>{total - score}</Text>
              <Text style={styles.scoreStatLabel}>Wrong</Text>
            </View>
            <View style={styles.scoreStatDivider} />
            <View style={styles.scoreStat}>
              <Text style={[styles.scoreStatValue, { color: Colors.textMuted }]}>{total}</Text>
              <Text style={styles.scoreStatLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={handleExportPdf} disabled={pdfLoading} activeOpacity={0.85} style={styles.pdfBtn}>
            {pdfLoading
              ? <ActivityIndicator size="small" color={Colors.textWhite} style={{ marginRight: 8 }} />
              : <FileText size={18} color={Colors.textWhite} style={{ marginRight: 6 }} />}
            <Text style={styles.pdfBtnText}>{pdfLoading ? 'Compiling...' : 'Export PDF'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} activeOpacity={0.85} style={styles.historyBtn}>
            <ClipboardList size={18} color={Colors.textPrimary} style={{ marginRight: 6 }} />
            <Text style={styles.historyBtnText}>History</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.reviewTitle}>Detailed Review</Text>
        <View style={{ paddingBottom: 24 }}>
          {questions.length > 0 && (() => {
            const q = questions[currentIndex];
            const qId = q.id || `q_${sessionId}_${currentIndex}`;
            const ans = studentAnswers[qId] || { selectedAnswer: '', isCorrect: false };
            return (
              <>
                <QuestionCard
                  question={q}
                  questionIndex={currentIndex}
                  totalQuestions={questions.length}
                  selectedAnswer={ans.selectedAnswer}
                  isReviewMode={true}
                />

                {/* Prev / Next navigation */}
                <View style={styles.navRow}>
                  <TouchableOpacity
                    onPress={goToPrev}
                    disabled={currentIndex === 0}
                    activeOpacity={0.75}
                    style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
                  >
                    <ChevronLeft size={18} color={currentIndex === 0 ? Colors.textLight : Colors.primary} />
                    <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>Prev</Text>
                  </TouchableOpacity>

                  {/* Dot indicators */}
                  <View style={styles.dotsRow}>
                    {questions.map((_, i) => (
                      <TouchableOpacity key={i} onPress={() => { setCurrentIndex(i); scrollRef.current?.scrollTo({ y: 0, animated: true }); }}>
                        <View style={[styles.dot, i === currentIndex && styles.dotActive]} />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity
                    onPress={goToNext}
                    disabled={currentIndex === questions.length - 1}
                    activeOpacity={0.75}
                    style={[styles.navBtn, currentIndex === questions.length - 1 && styles.navBtnDisabled]}
                  >
                    <Text style={[styles.navBtnText, currentIndex === questions.length - 1 && styles.navBtnTextDisabled]}>Next</Text>
                    <ChevronRight size={18} color={currentIndex === questions.length - 1 ? Colors.textLight : Colors.primary} />
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  homeBtn: { backgroundColor: Colors.primarySoft, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  homeBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  scoreCard: { borderRadius: 24, borderWidth: 1.5, padding: 22, alignItems: 'center', marginBottom: 20 },
  scoreBadge: { width: 68, height: 68, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  tierLabel: { fontSize: 13, fontFamily: Fonts.bold, letterSpacing: 0.3, marginBottom: 8, textTransform: 'uppercase' },
  scoreFractionRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 2 },
  scoreNumber: { fontSize: 56, fontFamily: Fonts.extraBold, letterSpacing: -2, lineHeight: 64 },
  scoreDivider: { fontSize: 22, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginBottom: 8 },
  scorePercent: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textMuted, marginBottom: 14 },
  scoreBarTrack: { width: '100%', height: 8, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 4, overflow: 'hidden', marginBottom: 18 },
  scoreBarFill: { height: 8, borderRadius: 4 },
  scoreStatRow: { flexDirection: 'row', width: '100%', alignItems: 'center' },
  scoreStat: { flex: 1, alignItems: 'center' },
  scoreStatDivider: { width: 1, height: 28, backgroundColor: 'rgba(0,0,0,0.08)' },
  scoreStatValue: { fontSize: 22, fontFamily: Fonts.extraBold, letterSpacing: -0.5 },
  scoreStatLabel: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  pdfBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 14, paddingVertical: 14, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, gap: 6 },
  pdfBtnIcon: { fontSize: 16 },
  pdfBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textWhite },
  historyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: Colors.border, gap: 6 },
  historyBtnIcon: { fontSize: 16 },
  historyBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textPrimary },
  reviewTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 14 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 24 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  navBtnDisabled: { borderColor: Colors.border, backgroundColor: Colors.surface },
  navBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  navBtnTextDisabled: { color: Colors.textLight },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18, borderRadius: 4 },
});
