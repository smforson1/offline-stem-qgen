// Owner: S3 | Purpose: Landing screen — dashboard with stats and primary actions

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused, CommonActions } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { sessionRepository } from '../db/sessionRepository';
import { Colors, Fonts } from '../theme/colors';
import { Settings, Camera, ClipboardList, FileText, ArrowRight } from 'lucide-react-native';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MainTabs'>;

const QuickActionButton = ({
  icon: Icon, label, onPress, tint,
}: { icon: any; label: string; onPress: () => void; tint: string }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.quickAction}>
    <View style={[styles.quickActionIcon, { backgroundColor: tint }]}>
      <Icon size={24} color={Colors.primary} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const isFocused = useIsFocused();
  const [sessionCount, setSessionCount] = useState(0);
  const [avgScore, setAvgScore] = useState<number | null>(null);
  const [bestScore, setBestScore] = useState<number | null>(null);

  useEffect(() => { if (isFocused) loadStats(); }, [isFocused]);

  const loadStats = async () => {
    try {
      const history = await sessionRepository.getSessions();
      setSessionCount(history.length);
      const graded = history.filter((s) => s.average_score !== undefined);
      if (graded.length > 0) {
        const sum = graded.reduce((acc, s) => acc + (s.average_score || 0), 0);
        setAvgScore(Math.round(sum / graded.length));
        setBestScore(Math.round(Math.max(...graded.map((s) => s.average_score || 0))));
      } else { setAvgScore(null); setBestScore(null); }
    } catch (e) { console.error('Failed to load stats:', e); }
  };

  const goHistory = () =>
    navigation.dispatch(CommonActions.navigate({ name: 'MainTabs', params: { screen: 'History' } }));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Day! 👋</Text>
            <Text style={styles.appTitle}>STEM QGen</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Settings size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Hero card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total Sessions</Text>
          <Text style={styles.heroValue}>{sessionCount}</Text>
          <Text style={styles.heroSub}>
            {sessionCount === 0
              ? 'No sessions yet — tap Generate Quiz to begin'
              : `${sessionCount} practice ${sessionCount === 1 ? 'session' : 'sessions'} completed`}
          </Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{avgScore !== null ? `${avgScore}%` : '—'}</Text>
              <Text style={styles.heroStatLabel}>Avg Score</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{bestScore !== null ? `${bestScore}%` : '—'}</Text>
              <Text style={styles.heroStatLabel}>Best Score</Text>
            </View>
            <View style={styles.heroStatDivider} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{sessionCount}</Text>
              <Text style={styles.heroStatLabel}>Quizzes</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsRow}>
          <QuickActionButton icon={Camera} label="New Quiz" onPress={() => navigation.navigate('Settings')} tint="#EEF2FF" />
          <QuickActionButton icon={ClipboardList} label="History" onPress={goHistory} tint="#F5F3FF" />
          <QuickActionButton icon={Settings} label="Settings" onPress={() => navigation.navigate('Settings')} tint="#EEF2FF" />
          <QuickActionButton icon={FileText} label="Export" onPress={goHistory} tint="#F5F3FF" />
        </View>

        {/* CTA cards */}
        <Text style={styles.sectionTitle}>Start Learning</Text>
        <TouchableOpacity activeOpacity={0.88} onPress={() => navigation.navigate('Settings')} style={styles.ctaPrimary}>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaTitle}>Generate Quiz</Text>
            <Text style={styles.ctaDesc}>Point your camera at any textbook page. AI generates custom questions instantly.</Text>
          </View>
          <View style={styles.ctaArrow}>
            <ArrowRight size={20} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.88} onPress={goHistory} style={styles.ctaSecondary}>
          <View style={styles.ctaTextBlock}>
            <Text style={styles.ctaSecTitle}>Review History</Text>
            <Text style={styles.ctaSecDesc}>Revisit past worksheets, check scores and export PDFs.</Text>
          </View>
          <View style={styles.ctaSecArrow}>
            <ArrowRight size={20} color={Colors.primary} />
          </View>
        </TouchableOpacity>

        <Text style={styles.footer}>Offline AI · Raspberry Pi Edge Node</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, marginTop: 6 },
  greeting: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textMuted, marginBottom: 2 },
  appTitle: { fontSize: 26, fontFamily: Fonts.extraBold, color: Colors.textPrimary, letterSpacing: -0.5 },
  settingsBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 3 },

  heroCard: { borderRadius: 24, backgroundColor: Colors.primary, padding: 22, marginBottom: 24, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 8, overflow: 'hidden' },
  heroLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  heroValue: { fontSize: 52, fontFamily: Fonts.extraBold, color: Colors.textWhite, letterSpacing: -2, lineHeight: 64 },
  heroSub: { fontSize: 12, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 16 },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center' },
  heroStat: { flex: 1, alignItems: 'center' },
  heroStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroStatValue: { fontSize: 20, fontFamily: Fonts.extraBold, color: Colors.textWhite, letterSpacing: -0.5 },
  heroStatLabel: { fontSize: 10, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.6)', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 14 },

  quickActionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  quickAction: { alignItems: 'center', width: '22%' },
  quickActionIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  quickActionLabel: { fontSize: 11, fontFamily: Fonts.semiBold, color: Colors.textPrimary, textAlign: 'center' },

  ctaPrimary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primarySoft, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  ctaTextBlock: { flex: 1, paddingRight: 12 },
  ctaTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.primary, marginBottom: 4 },
  ctaDesc: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 20 },
  ctaArrow: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },

  ctaSecondary: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  ctaSecTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 4 },
  ctaSecDesc: { fontSize: 12, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 20 },
  ctaSecArrow: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },

  footer: { textAlign: 'center', fontSize: 11, fontFamily: Fonts.medium, color: Colors.textLight, marginTop: 20, letterSpacing: 0.3 },
});
