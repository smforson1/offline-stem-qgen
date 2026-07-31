// Owner: S3 | Purpose: Lists past sessions fetched from local SQLite DB

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { Session } from '../types/Session';
import { sessionRepository } from '../db/sessionRepository';
import { questionRepository } from '../db/questionRepository';
import { Colors, Fonts } from '../theme/colors';
import { BookCopy } from 'lucide-react-native';

type HistoryScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const SUBJECT_COLORS: Record<string, { bg: string; text: string }> = {
  Physics:     { bg: '#EEF2FF', text: Colors.primary },
  Chemistry:   { bg: '#F5F3FF', text: Colors.accent },
  Biology:     { bg: '#D1FAE5', text: '#059669' },
  Mathematics: { bg: '#FEF3C7', text: '#D97706' },
  default:     { bg: Colors.primarySoft, text: Colors.primary },
};

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<HistoryScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [history, setHistory] = useState<Session[]>([]);

  useEffect(() => { if (isFocused) loadHistory(); }, [isFocused]);

  const loadHistory = async () => {
    try { setHistory(await sessionRepository.getSessions()); }
    catch (e) { console.error('Failed to load history:', e); }
  };

  const handleDeleteSession = (sessionId: string) => {
    Alert.alert('Delete Session', 'Remove this practice session from your history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await sessionRepository.deleteSession(sessionId); loadHistory(); }
        catch (e) { console.error('Failed to delete session:', e); }
      }},
    ]);
  };

  const handleSelectSession = async (session: Session) => {
    try {
      const questions = await questionRepository.getQuestionsBySession(session.id);
      const answersMap = await questionRepository.getStudentAnswersBySession(session.id);
      let correct = 0;
      questions.forEach((q, idx) => {
        const qId = q.id || `q_${session.id}_${idx}`;
        if (answersMap[qId]?.isCorrect) correct++;
      });
      navigation.navigate('Results', { sessionId: session.id, score: correct, total: questions.length });
    } catch (e) { console.error('Failed to load session details:', e); }
  };

  const formatDate = (dateStr: string) => {
    try { return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return dateStr; }
  };

  const renderItem = ({ item }: { item: Session }) => {
    const sc = SUBJECT_COLORS[item.subject] || SUBJECT_COLORS.default;
    const scoreNum = item.average_score !== undefined ? Math.round(item.average_score) : null;
    const scoreColor = scoreNum === null ? Colors.textMuted : scoreNum >= 80 ? Colors.success : scoreNum >= 50 ? Colors.primary : Colors.error;

    return (
      <TouchableOpacity onPress={() => handleSelectSession(item)} activeOpacity={0.78} style={styles.card}>
        <View style={[styles.cardStripe, { backgroundColor: sc.text }]} />
        <View style={styles.cardBody}>
          <View style={styles.cardTopRow}>
            <View style={[styles.subjectBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.subjectBadgeText, { color: sc.text }]}>{item.subject}</Text>
            </View>
            <View style={styles.difficultyBadge}>
              <Text style={styles.difficultyText}>{item.difficulty}</Text>
            </View>
            <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
          </View>
          <Text style={styles.contextPreview} numberOfLines={2}>{item.raw_context || 'Textbook scan session'}</Text>
          <View style={styles.cardBottomRow}>
            <View style={styles.scoreWrap}>
              <Text style={[styles.scoreValue, { color: scoreColor }]}>{scoreNum !== null ? `${scoreNum}%` : 'N/A'}</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
            <TouchableOpacity onPress={() => handleDeleteSession(item.id)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Practice Runs</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{history.length}</Text>
        </View>
      </View>
      <FlatList
        data={history} renderItem={renderItem} keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
        ListHeaderComponent={history.length > 0
          ? <Text style={styles.listSubtitle}>Tap any session to review answers and export worksheets.</Text>
          : null}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}><BookCopy size={40} color={Colors.primary} /></View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyDesc}>Complete your first quiz by scanning a textbook page to see history here.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  headerTitle: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.textPrimary, letterSpacing: -0.5, flex: 1 },
  countBadge: { backgroundColor: Colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  countBadgeText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, flexGrow: 1 },
  listSubtitle: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, marginBottom: 14, lineHeight: 18 },
  card: { backgroundColor: Colors.card, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, flexDirection: 'row', overflow: 'hidden', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  cardStripe: { width: 4, borderTopLeftRadius: 18, borderBottomLeftRadius: 18 },
  cardBody: { flex: 1, padding: 14 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  subjectBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  subjectBadgeText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.2 },
  difficultyBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  difficultyText: { fontSize: 10, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  dateText: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.textLight, marginLeft: 'auto' },
  contextPreview: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textPrimary, lineHeight: 19, marginBottom: 12 },
  cardBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreWrap: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  scoreValue: { fontSize: 18, fontFamily: Fonts.extraBold, letterSpacing: -0.4 },
  scoreLabel: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.textMuted, textTransform: 'uppercase' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.errorSoft },
  deleteBtnText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.error },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyIconWrap: { width: 88, height: 88, borderRadius: 28, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.textPrimary, marginBottom: 10 },
  emptyDesc: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
