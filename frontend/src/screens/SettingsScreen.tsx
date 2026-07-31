// Owner: S3 | Purpose: Session config — server URL, subject, difficulty, question type & count

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { Colors, Fonts } from '../theme/colors';
import { Link2, Target, LogOut } from 'lucide-react-native';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

const ChipGroup = ({ label, options, selected, onSelect }: {
  label: string;
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) => (
  <View style={styles.chipGroup}>
    <Text style={styles.chipGroupLabel}>{label}</Text>
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onSelect(o.value)} activeOpacity={0.75}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const settings = useSettingsStore();
  const authStore = useAuthStore();
  const [localUrl, setLocalUrl] = useState(settings.apiUrl);

  const saveUrl = () => {
    let url = localUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `http://${url}`;
    settings.setApiUrl(url);
  };

  const handleProceed = () => { saveUrl(); navigation.navigate('Capture'); };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { saveUrl(); navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quiz Settings</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pageTitleBlock}>
          <Text style={styles.pageTitle}>Session{'\n'}<Text style={styles.pageTitleAccent}>Parameters</Text></Text>
          <Text style={styles.pageSubtitle}>Configure backend and quiz criteria before scanning.</Text>
        </View>

        {/* Server card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBadge, { backgroundColor: Colors.primarySoft }]}>
              <Link2 size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Local Gateway IP</Text>
              <Text style={styles.cardSubtitle}>Raspberry Pi LAN address</Text>
            </View>
          </View>
          <TextInput
            value={localUrl} onChangeText={setLocalUrl} onBlur={saveUrl}
            placeholder="e.g. http://192.168.4.1:5000" placeholderTextColor={Colors.textLight}
            style={styles.input} autoCapitalize="none" autoCorrect={false} keyboardType="url"
          />
        </View>

        {/* Presets card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBadge, { backgroundColor: Colors.accentSoft }]}>
              <Target size={20} color={Colors.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Inference Criteria</Text>
              <Text style={styles.cardSubtitle}>Subject, difficulty and format</Text>
            </View>
          </View>
          <ChipGroup label="Subject"
            options={[{label:'Physics',value:'Physics'},{label:'Chemistry',value:'Chemistry'},{label:'Biology',value:'Biology'},{label:'Mathematics',value:'Mathematics'}]}
            selected={settings.defaultSubject} onSelect={settings.setDefaultSubject} />
          <ChipGroup label="Difficulty"
            options={[{label:'Easy',value:'Easy'},{label:'Medium',value:'Medium'},{label:'Hard',value:'Hard'}]}
            selected={settings.defaultDifficulty} onSelect={settings.setDefaultDifficulty} />
          <ChipGroup label="Question Format"
            options={[{label:'Multiple Choice',value:'mcq'},{label:'Short Answer',value:'short_answer'}]}
            selected={settings.defaultQuestionType}
            onSelect={(v) => settings.setDefaultQuestionType(v as 'mcq' | 'short_answer')} />
          <ChipGroup label="Question Count"
            options={[{label:'3',value:'3'},{label:'5',value:'5'},{label:'10',value:'10'}]}
            selected={String(settings.defaultQuestionCount)}
            onSelect={(v) => settings.setDefaultQuestionCount(Number(v))} />
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={handleProceed} style={styles.proceedBtn}>
          <Text style={styles.proceedBtnText}>Proceed to Capture</Text>
        </TouchableOpacity>

        <View style={styles.logoutWrapper}>
          <Text style={styles.currentUserText}>
            Logged in as {authStore.user?.name || 'Student'}
          </Text>
          <TouchableOpacity activeOpacity={0.75} onPress={() => authStore.logout()} style={styles.logoutBtn}>
            <LogOut size={16} color={Colors.error} style={{ marginRight: 6 }} />
            <Text style={styles.logoutBtnText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: Colors.surface },
  backBtnText: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.primary },
  headerTitle: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textPrimary },
  scroll: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  pageTitleBlock: { marginBottom: 24 },
  pageTitle: { fontSize: 30, fontFamily: Fonts.extraBold, color: Colors.textPrimary, lineHeight: 40, marginBottom: 6 },
  pageTitleAccent: { color: Colors.primary, fontFamily: Fonts.extraBold },
  pageSubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  cardIconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted },
  input: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: Fonts.medium, color: Colors.textPrimary },
  chipGroup: { marginBottom: 16 },
  chipGroupLabel: { fontSize: 12, fontFamily: Fonts.semiBold, color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primarySoft, borderColor: Colors.primary },
  chipText: { fontSize: 13, fontFamily: Fonts.medium, color: Colors.textMuted },
  chipTextActive: { fontFamily: Fonts.bold, color: Colors.primary },
  proceedBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  proceedBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textWhite, letterSpacing: 0.2 },
  logoutWrapper: { marginTop: 40, alignItems: 'center' },
  currentUserText: { fontSize: 12, fontFamily: Fonts.medium, color: Colors.textMuted, marginBottom: 12 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.errorSoft, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 },
  logoutBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: Colors.error },
});
