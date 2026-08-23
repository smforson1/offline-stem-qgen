// Owner: S3 | Purpose: Animated streaming progress overlay — shows live SSE generation progress

import React, { useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Fonts } from '../theme/colors';

export type StreamStage = 'ocr' | 'generating' | 'saving';

interface StreamingProgressOverlayProps {
  visible: boolean;
  stage: StreamStage;
  questionsDone: number;
  questionsTotal: number;
}

const STAGE_CONFIG: Record<StreamStage, { icon: string; label: string; sublabel: string }> = {
  ocr:        { icon: '📷', label: 'Reading Page',  sublabel: 'Extracting text from image...' },
  generating: { icon: '🤖', label: 'Generating',    sublabel: 'AI is writing your questions...' },
  saving:     { icon: '💾', label: 'Almost Done',   sublabel: 'Saving to local storage...' },
};

export const StreamingProgressOverlay: React.FC<StreamingProgressOverlayProps> = ({
  visible,
  stage,
  questionsDone,
  questionsTotal,
}) => {
  const progressAnim  = useRef(new Animated.Value(0)).current;
  const spinAnim      = useRef(new Animated.Value(0)).current;
  const slideAnim     = useRef(new Animated.Value(60)).current;
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const questionAnims = useRef(
    Array.from({ length: 10 }, () => new Animated.Value(0))
  ).current;

  // 5% reserved for OCR start, 85% for questions, 10% for saving
  const targetProgress = (() => {
    if (stage === 'ocr') return 0.05;
    if (stage === 'saving') return 1.0;
    if (questionsTotal === 0) return 0.1;
    return 0.05 + (questionsDone / questionsTotal) * 0.85;
  })();

  // Smooth progress bar fill
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: targetProgress,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetProgress]);

  // Pop in each question pill when it completes
  useEffect(() => {
    if (questionsDone > 0 && questionsDone <= 10) {
      Animated.spring(questionAnims[questionsDone - 1], {
        toValue: 1,
        tension: 180,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [questionsDone]);

  // Slide-up card entrance when overlay opens; reset pills on close
  useEffect(() => {
    if (visible) {
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, easing: Easing.out(Easing.quad),         useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.back(1.2)), useNativeDriver: true }),
      ]).start();
    } else {
      questionAnims.forEach((a) => a.setValue(0));
      progressAnim.setValue(0);
    }
  }, [visible]);

  // Perpetual spinner ring rotation
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const { icon, label, sublabel } = STAGE_CONFIG[stage];
  const showQuestions = stage === 'generating' && questionsTotal > 0;

  return (
    <Modal transparent animationType="none" visible={visible} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>

          {/* Stage header with rotating ring */}
          <View style={styles.stageRow}>
            <Animated.View style={[styles.spinnerRing, { transform: [{ rotate: spin }] }]} />
            <Text style={styles.stageIcon}>{icon}</Text>
            <View style={styles.stageTextWrap}>
              <Text style={styles.stageLabel}>{label}</Text>
              <Text style={styles.stageSub}>{sublabel}</Text>
            </View>
          </View>

          {/* Animated progress bar */}
          <View style={styles.progressTrack}>
            <Animated.View
              style={[styles.progressFill, {
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              }]}
            />
          </View>

          {/* Counter label */}
          {showQuestions && (
            <Text style={styles.counterText}>
              {questionsDone} of {questionsTotal} question{questionsTotal !== 1 ? 's' : ''} ready
            </Text>
          )}

          {/* Animated checkmark pills, one per question */}
          {showQuestions && (
            <View style={styles.questionsGrid}>
              {Array.from({ length: questionsTotal }, (_, i) => {
                const isDone = i < questionsDone;
                const anim   = questionAnims[i] ?? new Animated.Value(isDone ? 1 : 0);
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.questionPill,
                      isDone && styles.questionPillDone,
                      {
                        opacity: anim,
                        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                      },
                    ]}
                  >
                    <Text style={[styles.questionPillText, isDone && styles.questionPillTextDone]}>
                      {isDone ? '✓' : `Q${i + 1}`}
                    </Text>
                  </Animated.View>
                );
              })}
            </View>
          )}

          {/* Footer hint chip */}
          <View style={styles.hint}>
            <Text style={styles.hintText}>Processing on local backend · Stay on this screen</Text>
          </View>

        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.60)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 28,
    width: '100%',
    alignItems: 'stretch',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stageRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, position: 'relative' },
  spinnerRing: {
    position: 'absolute',
    left: -2,
    top: -2,
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Colors.primary,
    borderTopColor: 'transparent',
  },
  stageIcon:     { fontSize: 28, width: 52, textAlign: 'center', marginRight: 14 },
  stageTextWrap: { flex: 1 },
  stageLabel:    { fontSize: 17, fontFamily: Fonts.extraBold, color: Colors.textPrimary, marginBottom: 2 },
  stageSub:      { fontSize: 12, fontFamily: Fonts.regular,   color: Colors.textMuted },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: Colors.primarySoft, overflow: 'hidden', marginBottom: 10 },
  progressFill:  { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
  counterText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    textAlign: 'right',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  questionsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  questionPill:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: Colors.surface,     borderWidth: 1.5, borderColor: Colors.border   },
  questionPillDone:     {                                                                backgroundColor: Colors.successSoft, borderWidth: 1.5, borderColor: Colors.success  },
  questionPillText:     { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textMuted },
  questionPillTextDone: { color: Colors.success },
  hint:     { backgroundColor: Colors.surface, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  hintText: { fontSize: 10, fontFamily: Fonts.medium, color: Colors.textMuted, letterSpacing: 0.2 },
});
