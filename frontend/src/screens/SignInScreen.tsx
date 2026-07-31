// Owner: S3 | Purpose: Local Offline Sign In Screen

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../types/Navigation';
import { useAuthStore } from '../store/useAuthStore';
import { Colors, Fonts } from '../theme/colors';
import { Mail, Lock } from 'lucide-react-native';

type SignInScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignIn'>;

export const SignInScreen: React.FC = () => {
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = () => {
    if (!email.trim() || !password.trim()) {
      alert('Please enter your email and password.');
      return;
    }
    // Simulate finding a user. Since it's offline and fake auth for demo, we just log them in.
    login({ name: email.split('@')[0] || 'Student', email });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your STEM learning journey.</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={Colors.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textLight}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity activeOpacity={0.85} onPress={handleSignIn} style={styles.submitBtn}>
              <Text style={styles.submitBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.replace('SignUp')}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 10, paddingBottom: 40 },
  
  backBtn: { alignSelf: 'flex-start', paddingVertical: 8, marginBottom: 20 },
  backBtnText: { fontSize: 14, fontFamily: Fonts.semiBold, color: Colors.primary },

  header: { marginBottom: 40 },
  title: { fontSize: 32, fontFamily: Fonts.extraBold, color: Colors.textPrimary, letterSpacing: -1, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted, lineHeight: 22 },

  form: { gap: 20 },
  inputGroup: { gap: 8 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, color: Colors.textPrimary },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 16, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, paddingVertical: 16, fontSize: 15, fontFamily: Fonts.medium, color: Colors.textPrimary },

  submitBtn: { backgroundColor: Colors.primary, paddingVertical: 18, borderRadius: 18, alignItems: 'center', marginTop: 12, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  submitBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: Colors.textWhite },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 40 },
  footerText: { fontSize: 14, fontFamily: Fonts.regular, color: Colors.textMuted },
  footerLink: { fontSize: 14, fontFamily: Fonts.bold, color: Colors.primary },
});
