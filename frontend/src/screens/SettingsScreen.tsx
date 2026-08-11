// Owner: S3 | Purpose: Connection settings — backend URL only (offline version)

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../types/Navigation';
import { useSettingsStore } from '../store/useSettingsStore';
import { Colors, Fonts } from '../theme/colors';
import { Link2, Wifi } from 'lucide-react-native';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const settings = useSettingsStore();
  const [localUrl, setLocalUrl] = useState(settings.apiUrl);

  const save = () => {
    let url = localUrl.trim();
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) url = `http://${url}`;
    settings.setApiUrl(url);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { save(); navigation.goBack(); }} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Connection Settings</Text>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pageTitleBlock}>
          <Text style={styles.pageTitle}>Backend{'\n'}<Text style={styles.pageTitleAccent}>Connection</Text></Text>
          <Text style={styles.pageSubtitle}>Configure how the app connects to the AI backend. Quiz preferences are set on the Capture screen.</Text>
        </View>

        {/* Backend URL */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconBadge, { backgroundColor: Colors.primarySoft }]}>
              <Link2 size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Local Backend URL</Text>
              <Text style={styles.cardSubtitle}>Your laptop's IP address running the Flask server</Text>
            </View>
          </View>
          <TextInput
            value={localUrl}
            onChangeText={setLocalUrl}
            onBlur={save}
            placeholder="e.g. http://192.168.1.100:5000"
            placeholderTextColor={Colors.textLight}
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={[styles.cardSubtitle, { marginTop: 8 }]}>
            Tip: For Android emulator use http://10.0.2.2:5000
          </Text>
        </View>

        {/* Info card */}
        <View style={[styles.card, { backgroundColor: Colors.primarySoft, borderColor: Colors.primary + '33' }]}>
          <View style={styles.cardHeaderRow}>
            <Wifi size={18} color={Colors.primary} />
            <Text style={[styles.cardTitle, { color: Colors.primary, marginLeft: 10 }]}>How it works</Text>
          </View>
          <Text style={[styles.cardSubtitle, { lineHeight: 18 }]}>
            The phone connects to your laptop over local Wi-Fi. Both must be on the same network (hotspot or router). The backend runs OCR and AI question generation on your laptop.
          </Text>
        </View>

        <TouchableOpacity activeOpacity={0.85} onPress={() => { save(); navigation.goBack(); }} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Save & Go Back</Text>
        </TouchableOpacity>
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
  pageTitle: { fontSize: 28, fontFamily: Fonts.extraBold, color: Colors.textPrimary, lineHeight: 36, marginBottom: 6 },
  pageTitleAccent: { color: Colors.primary, fontFamily: Fonts.extraBold },
  pageSubtitle: { fontSize: 13, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: Colors.border, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 8, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardIconBadge: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.textPrimary, marginBottom: 2 },
  cardSubtitle: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted },
  input: { backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: Fonts.medium, color: Colors.textPrimary },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  saveBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: Colors.textWhite },
});
