// Owner: S3 | Purpose: Full-screen loading modal shown during OCR / LLM processing

import React from 'react';
import { View, Text, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../theme/colors';

interface LoadingOverlayProps {
  visible: boolean;
  stepMessage?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  stepMessage = 'Processing textbook data...',
}) => {
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.spinnerWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, { opacity: 0.3 + i * 0.3 }]} />
            ))}
          </View>
          <Text style={styles.title}>Please Wait</Text>
          <Text style={styles.message}>{stepMessage}</Text>
          <View style={styles.hint}>
            <Text style={styles.hintText}>Processing on Raspberry Pi edge node</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 27, 75, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spinnerWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  dotsRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.primary },
  title: {
    fontSize: 18,
    fontFamily: Fonts.extraBold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  message: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  hint: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hintText: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
});
