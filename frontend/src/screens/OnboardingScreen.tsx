// Owner: S3 | Purpose: Welcome and Onboarding screen

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../types/Navigation';
import { Colors, Fonts } from '../theme/colors';
import { Cpu, Brain, WifiOff } from 'lucide-react-native';

const { width } = Dimensions.get('window');

type OnboardingScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<OnboardingScreenNavigationProp>();

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>STEM QGen</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>BETA</Text>
          </View>
        </View>

        {/* Hero */}
        <View style={styles.heroWrapper}>
          <View style={styles.heroCircle} />
          <Brain size={80} color={Colors.primary} style={styles.heroIcon} />
        </View>

        {/* Heading */}
        <Text style={styles.mainHeading}>
          Master STEM,{'\n'}Completely <Text style={styles.accentText}>Offline</Text>.
        </Text>
        <Text style={styles.subtitle}>
          Scan your textbook and let our local AI generate custom quizzes on your local edge backend. No internet required.
        </Text>

        {/* Feature cards */}
        <View style={styles.features}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Cpu size={20} color={Colors.primary} />
            </View>
            <Text style={styles.featureText}>Edge AI Powered</Text>
          </View>
          <View style={styles.featureItem}>
            <View style={[styles.featureIconWrap, { backgroundColor: '#F5F3FF' }]}>
              <WifiOff size={20} color={Colors.accent} />
            </View>
            <Text style={styles.featureText}>100% Offline</Text>
          </View>
        </View>

        {/* Buttons */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SignUp')}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SignIn')}
            style={styles.secondaryBtn}
          >
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.textPrimary, letterSpacing: -0.5 },
  badge: { backgroundColor: Colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.primary, letterSpacing: 1 },

  heroWrapper: { alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 24 },
  heroCircle: { width: width * 0.45, height: width * 0.45, borderRadius: width * 0.225, backgroundColor: Colors.primarySoft, position: 'absolute' },
  heroIcon: { zIndex: 10 },

  mainHeading: { fontSize: 36, fontFamily: Fonts.extraBold, color: Colors.textPrimary, lineHeight: 44, letterSpacing: -1, marginBottom: 14 },
  accentText: { color: Colors.primary },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 22, marginBottom: 24 },

  features: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  featureItem: { flex: 1, backgroundColor: Colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  featureIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textPrimary },

  footer: { gap: 12 },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 18, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textWhite },
  secondaryBtn: { paddingVertical: 16, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textMuted },
});
