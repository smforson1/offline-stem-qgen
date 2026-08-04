// Owner: S3 | Purpose: Welcome and Onboarding screen

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
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
      <View style={styles.content}>
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
          <Brain size={72} color={Colors.primary} style={styles.heroIcon} />
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

        {/* Buttons pinned to bottom */}
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
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32, justifyContent: 'space-between' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontFamily: Fonts.extraBold, color: Colors.textPrimary, letterSpacing: -0.5 },
  badge: { backgroundColor: Colors.primarySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontFamily: Fonts.bold, color: Colors.primary, letterSpacing: 1 },

  heroWrapper: { alignItems: 'center', justifyContent: 'center' },
  heroCircle: { width: width * 0.40, height: width * 0.40, borderRadius: width * 0.20, backgroundColor: Colors.primarySoft, position: 'absolute' },
  heroIcon: { zIndex: 10 },

  mainHeading: { fontSize: 32, fontFamily: Fonts.extraBold, color: Colors.textPrimary, lineHeight: 40, letterSpacing: -1 },
  accentText: { color: Colors.primary },
  subtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 20 },

  features: { flexDirection: 'row', gap: 12 },
  featureItem: { flex: 1, backgroundColor: Colors.card, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  featureIconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  featureText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textPrimary },

  footer: { gap: 10 },
  primaryBtn: { backgroundColor: Colors.primary, paddingVertical: 17, borderRadius: 18, alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  primaryBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textWhite },
  secondaryBtn: { paddingVertical: 12, alignItems: 'center' },
  secondaryBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.textMuted },
});
