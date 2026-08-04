// Owner: S3 | Purpose: Displays generated questions and collects student answers

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { useSessionStore } from '../store/useSessionStore';
import { questionRepository } from '../db/questionRepository';
import { sessionRepository } from '../db/sessionRepository';
import { QuestionCard } from '../components/QuestionCard';
import { Colors, Fonts } from '../theme/colors';
import { Edit3, Check } from 'lucide-react-native';

type QuestionScreenRouteProp = RouteProp<RootStackParamList, 'Question'>;
type QuestionScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Question'>;

export const QuestionScreen: React.FC = () => {
  const navigation = useNavigation<QuestionScreenNavigationProp>();
  const route = useRoute<QuestionScreenRouteProp>();
  const { sessionId } = route.params;
  const sessionStore = useSessionStore();

  useEffect(() => {
    if (!sessionStore.activeSession || sessionStore.activeSession.id !== sessionId) loadSessionFromDb();
  }, [sessionId]);

  const loadSessionFromDb = async () => {
    try {
      const session = await sessionRepository.getSessionById(sessionId);
      if (!session) { alert('Session not found.'); navigation.navigate('MainTabs'); return; }
      const questions = await questionRepository.getQuestionsBySession(sessionId);
      sessionStore.startSession(session, questions);
    } catch (e) { console.error('Failed to load session:', e); }
  };

  const activeQuestion = sessionStore.questions[sessionStore.currentQuestionIndex];
  const totalQuestions = sessionStore.questions.length;

  if (totalQuestions === 0 || !activeQuestion) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top', 'bottom']}>
        <Text style={{ fontFamily: Fonts.medium, color: Colors.textMuted, fontSize: 13 }}>Loading questions...</Text>
      </SafeAreaView>
    );
  }

  const selectedAnswer = sessionStore.userAnswers[sessionStore.currentQuestionIndex] || '';
  const isLastQuestion = sessionStore.currentQuestionIndex === totalQuestions - 1;
  const progressRatio = (sessionStore.currentQuestionIndex + 1) / totalQuestions;
  const answeredCount = Object.keys(sessionStore.userAnswers).length;

  const handleSubmit = async () => {
    let correctCount = 0;
    const answersToSave = sessionStore.questions.map((q, idx) => {
      const studentAns = sessionStore.userAnswers[idx] || '';
      // Normalise both sides: trim whitespace and collapse internal spaces
      const normalise = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
      const isCorrect = normalise(studentAns) === normalise(q.correct_answer);
      if (isCorrect) correctCount++;      // Use the question's DB id if available, otherwise fall back to the generated key
      const questionId = q.id || `q_${sessionId}_${idx}`;
      return { questionId, selectedAnswer: studentAns, isCorrect };
    });
    try {
      await questionRepository.saveStudentAnswers(answersToSave, sessionId);
      navigation.replace('Results', { sessionId, score: correctCount, total: totalQuestions });
    } catch (e) { alert('Failed to submit. Try again.'); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('MainTabs')} style={styles.quitBtn}>
          <Text style={styles.quitBtnText}>← Quit</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{sessionStore.activeSession?.subject || 'STEM'} Quiz</Text>
        <View style={styles.progressBadge}>
          <Text style={styles.progressBadgeText}>{sessionStore.currentQuestionIndex + 1}/{totalQuestions}</Text>
        </View>
      </View>

      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
            <Edit3 size={12} color={Colors.primary} />
            <Text style={styles.statPillText}>{answeredCount} of {totalQuestions} answered</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: Colors.accentSoft }]}>
            <Text style={[styles.statPillText, { color: Colors.accent }]}>
              {sessionStore.activeSession?.difficulty || 'Medium'}
            </Text>
          </View>
        </View>

        <QuestionCard
          question={activeQuestion}
          questionIndex={sessionStore.currentQuestionIndex}
          totalQuestions={totalQuestions}
          selectedAnswer={selectedAnswer}
          onSelectAnswer={(a) => sessionStore.selectAnswer(sessionStore.currentQuestionIndex, a)}
          isReviewMode={false}
        />

        <View style={styles.navRow}>
          <TouchableOpacity
            disabled={sessionStore.currentQuestionIndex === 0}
            onPress={() => sessionStore.setCurrentQuestionIndex(sessionStore.currentQuestionIndex - 1)}
            style={[styles.navBtn, sessionStore.currentQuestionIndex === 0 && styles.navBtnDisabled]}
          >
            <Text style={[styles.navBtnText, sessionStore.currentQuestionIndex === 0 && styles.navBtnTextDisabled]}>
              ← Previous
            </Text>
          </TouchableOpacity>

          {isLastQuestion ? (
            <TouchableOpacity onPress={handleSubmit} style={[styles.submitBtn, { flexDirection: 'row', justifyContent: 'center', gap: 6 }]}>
              <Text style={styles.submitBtnText}>Finish & Grade</Text>
              <Check size={16} color={Colors.textWhite} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => sessionStore.setCurrentQuestionIndex(sessionStore.currentQuestionIndex + 1)}
              style={styles.nextBtn}
            >
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.dotsRow}>
          {sessionStore.questions.map((_, idx) => (
            <TouchableOpacity key={idx} onPress={() => sessionStore.setCurrentQuestionIndex(idx)}
              style={[styles.dot,
                idx === sessionStore.currentQuestionIndex && styles.dotActive,
                sessionStore.userAnswers[idx] !== undefined && styles.dotAnswered,
              ]}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  quitBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.surface },
  quitBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  progressBadge: { backgroundColor: Colors.primarySoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  progressBadgeText: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary },
  progressBarTrack: { height: 4, backgroundColor: Colors.border, width: '100%' },
  progressBarFill: { height: 4, backgroundColor: Colors.primary, borderRadius: 2 },
  scroll: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  statsRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  statPill: { backgroundColor: Colors.primarySoft, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statPillText: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.primary },
  navRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, marginBottom: 20, gap: 12 },
  navBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  navBtnTextDisabled: { color: Colors.textLight },
  nextBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.primarySoft, borderWidth: 1.5, borderColor: Colors.primary },
  nextBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.primary },
  submitBtn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: 'center', backgroundColor: Colors.primary, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.textWhite },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.primary, width: 18 },
  dotAnswered: { backgroundColor: Colors.primaryLight },
});
