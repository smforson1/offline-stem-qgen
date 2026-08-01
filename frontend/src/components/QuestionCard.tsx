// Owner: S3 | Purpose: Reusable card — renders a single question with answer options

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Question } from '../types/Question';
import { Colors, Fonts } from '../theme/colors';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

interface QuestionCardProps {
  question: Question;
  questionIndex: number;
  totalQuestions: number;
  selectedAnswer?: string;
  onSelectAnswer?: (answer: string) => void;
  isReviewMode?: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question, questionIndex, totalQuestions,
  selectedAnswer = '', onSelectAnswer, isReviewMode = false,
}) => {
  const isMcq = question.options && question.options.length > 0;
  const [explanationOpen, setExplanationOpen] = useState(false);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.indexBadge}>
          <Text style={styles.indexBadgeText}>Q{questionIndex + 1}</Text>
        </View>
        <Text style={styles.ofText}>of {totalQuestions}</Text>
        {isReviewMode && (
          <View style={[styles.resultBadge, {
            backgroundColor: selectedAnswer === question.correct_answer ? Colors.successSoft : Colors.errorSoft,
          }]}>
            <Text style={[styles.resultBadgeText, {
              color: selectedAnswer === question.correct_answer ? Colors.success : Colors.error,
            }]}>
              {selectedAnswer === question.correct_answer ? '✓ Correct' : '✗ Incorrect'}
            </Text>
          </View>
        )}
      </View>

      {/* Question text */}
      <Text style={styles.questionText}>{question.question_text}</Text>

      {/* MCQ options */}
      {isMcq ? (
        <View style={styles.optionsContainer}>
          {question.options!.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === question.correct_answer;

            let containerStyle = styles.optionDefault;
            let textStyle = styles.optionTextDefault;
            let radioStyle = styles.radioDefault;
            let radioDotVisible = false;

            if (isReviewMode) {
              if (isCorrect) {
                containerStyle = styles.optionCorrect;
                textStyle = styles.optionTextCorrect;
                radioStyle = styles.radioCorrect;
                radioDotVisible = true;
              } else if (isSelected) {
                containerStyle = styles.optionWrong;
                textStyle = styles.optionTextWrong;
                radioStyle = styles.radioWrong;
                radioDotVisible = true;
              } else {
                containerStyle = styles.optionDimmed;
                textStyle = styles.optionTextDimmed;
              }
            } else if (isSelected) {
              containerStyle = styles.optionSelected;
              textStyle = styles.optionTextSelected;
              radioStyle = styles.radioSelected;
              radioDotVisible = true;
            }

            return (
              <TouchableOpacity
                key={idx}
                disabled={isReviewMode}
                onPress={() => onSelectAnswer && onSelectAnswer(option)}
                activeOpacity={0.72}
                style={[styles.optionBase, containerStyle]}
              >
                <View style={[styles.letterBadge,
                  (isSelected || (isReviewMode && isCorrect))
                    ? { backgroundColor: isReviewMode && isCorrect ? Colors.success : isReviewMode && isSelected ? Colors.error : Colors.primary }
                    : { backgroundColor: Colors.surface }
                ]}>
                  <Text style={[styles.letterText, (isSelected || (isReviewMode && isCorrect)) && { color: '#fff' }]}>
                    {OPTION_LETTERS[idx]}
                  </Text>
                </View>
                <Text style={[styles.optionTextBase, textStyle]} numberOfLines={3}>
                  {option}
                </Text>
                <View style={[styles.radioBase, radioStyle]}>
                  {radioDotVisible && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.shortAnswerContainer}>
          {isReviewMode ? (
            <View style={styles.reviewAnswers}>
              <View style={styles.yourAnswerBox}>
                <Text style={styles.answerBoxLabel}>Your Answer</Text>
                <Text style={styles.yourAnswerText}>{selectedAnswer || '(No answer provided)'}</Text>
              </View>
              <View style={styles.correctAnswerBox}>
                <Text style={[styles.answerBoxLabel, { color: Colors.success }]}>Expected Answer</Text>
                <Text style={styles.correctAnswerText}>{question.correct_answer}</Text>
              </View>
            </View>
          ) : (
            <TextInput
              value={selectedAnswer}
              onChangeText={(t) => onSelectAnswer && onSelectAnswer(t)}
              placeholder="Write your answer here..."
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={4}
              style={styles.textInput}
              textAlignVertical="top"
            />
          )}
        </View>
      )}

      {/* Explanation — collapsible in review mode */}
      {isReviewMode && question.explanation && (
        <View style={styles.explanationBox}>
          <TouchableOpacity
            onPress={() => setExplanationOpen((o) => !o)}
            activeOpacity={0.75}
            style={styles.explanationHeader}
          >
            <View style={styles.explanationIconWrap}>
              <Text style={{ fontSize: 14 }}>💡</Text>
            </View>
            <Text style={styles.explanationTitle}>Explanation</Text>
            {explanationOpen
              ? <ChevronUp size={16} color={Colors.primary} style={{ marginLeft: 'auto' }} />
              : <ChevronDown size={16} color={Colors.primary} style={{ marginLeft: 'auto' }} />}
          </TouchableOpacity>
          {explanationOpen && (
            <Text style={styles.explanationText}>{question.explanation}</Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  indexBadge: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  indexBadgeText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.3 },
  ofText: { fontSize: 11, fontFamily: Fonts.medium, color: Colors.textMuted, flex: 1 },
  resultBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  resultBadgeText: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.2 },

  questionText: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    lineHeight: 26,
    marginBottom: 16,
  },

  optionsContainer: { gap: 10 },
  optionBase: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, padding: 13, borderWidth: 1.5, gap: 12 },
  optionDefault: { backgroundColor: Colors.surface, borderColor: Colors.border },
  optionSelected: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  optionCorrect: { backgroundColor: Colors.successSoft, borderColor: Colors.success },
  optionWrong: { backgroundColor: Colors.errorSoft, borderColor: Colors.error },
  optionDimmed: { backgroundColor: Colors.surface, borderColor: Colors.border, opacity: 0.5 },

  letterBadge: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  letterText: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.textMuted },

  optionTextBase: { flex: 1, fontSize: 13, lineHeight: 20, fontFamily: Fonts.medium },
  optionTextDefault: { color: Colors.textPrimary, fontFamily: Fonts.medium },
  optionTextSelected: { color: Colors.primary, fontFamily: Fonts.semiBold },
  optionTextCorrect: { color: Colors.success, fontFamily: Fonts.semiBold },
  optionTextWrong: { color: Colors.error, fontFamily: Fonts.semiBold },
  optionTextDimmed: { color: Colors.textMuted, fontFamily: Fonts.regular },

  radioBase: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDefault: { borderColor: Colors.border },
  radioSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  radioCorrect: { borderColor: Colors.success, backgroundColor: Colors.success },
  radioWrong: { borderColor: Colors.error, backgroundColor: Colors.error },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },

  shortAnswerContainer: { marginTop: 4 },
  textInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    minHeight: 110,
  },
  reviewAnswers: { gap: 10 },
  yourAnswerBox: { backgroundColor: Colors.errorSoft, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.error + '33' },
  correctAnswerBox: { backgroundColor: Colors.successSoft, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.success + '33' },
  answerBoxLabel: { fontSize: 10, fontFamily: Fonts.bold, color: Colors.error, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  yourAnswerText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textPrimary, lineHeight: 19 },
  correctAnswerText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textPrimary, lineHeight: 19 },

  explanationBox: { marginTop: 16, backgroundColor: Colors.primarySoft, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.border },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  explanationIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  explanationTitle: { fontSize: 12, fontFamily: Fonts.bold, color: Colors.primary, textTransform: 'uppercase', letterSpacing: 0.5 },
  explanationText: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textPrimary, lineHeight: 20, marginTop: 10 },
});
