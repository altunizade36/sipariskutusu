import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  containerDark: {
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -2,
  },
  logoDark: {
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 8,
    fontWeight: '500',
    letterSpacing: 1.5,
  },
  subtitleDark: {
    color: '#999999',
  },
  formContainer: {
    marginBottom: 24,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabContainerDark: {
    borderBottomColor: '#2A2A2A',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  labelDark: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  inputDark: {
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
    color: '#FFFFFF',
  },
  inputPlaceholder: {
    color: '#999999',
  },
  button: {
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  linkButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  linkText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  demoContainer: {
    backgroundColor: '#F0F9FF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  demoContainerDark: {
    backgroundColor: '#1E3A5F',
  },
  demoText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '500',
    marginBottom: 8,
  },
  demoTextDark: {
    color: '#93C5FD',
  },
  demoButton: {
    backgroundColor: '#0369A1',
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    marginVertical: 6,
  },
  demoBuyerButton: {
    backgroundColor: '#3B82F6',
  },
  demoSellerButton: {
    backgroundColor: '#8B5CF6',
  },
  demoButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  themeToggle: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  themeToggleDark: {
    backgroundColor: '#2A2A2A',
  },
  themeToggleText: {
    fontSize: 20,
  },
});

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { isDarkMode, toggleDarkMode, signInWithPassword, signUpWithPassword, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [accountRole, setAccountRole] = useState<'buyer' | 'seller'>('buyer');

  const handleAuth = async () => {
    try {
      setError('');
      if (!email || !password) {
        setError('Tüm alanları doldurunuz');
        return;
      }

      if (mode === 'login') {
        await signInWithPassword(email, password);
        router.replace('/(tabs)');
      } else {
        if (!fullName) {
          setError('Ad Soyad gereklidir');
          return;
        }
        await signUpWithPassword(email, password, fullName, accountRole);
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setError(err?.message || 'Bir hata oluştu');
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string, role: 'buyer' | 'seller') => {
    try {
      setError('');
      await signInWithPassword(demoEmail, demoPassword);
      router.replace('/(tabs)');
    } catch (err: any) {
      setError(`Demo giriş başarısız: ${err?.message}`);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, isDarkMode && styles.containerDark]}
    >
      <TouchableOpacity
        style={[styles.themeToggle, isDarkMode && styles.themeToggleDark]}
        onPress={toggleDarkMode}
      >
        <Text style={styles.themeToggleText}>{isDarkMode ? '🌙' : '☀️'}</Text>
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoContainer}>
          <Text style={[styles.logo, isDarkMode && styles.logoDark]}>BO</Text>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            SİPARİŞ KUTUSU
          </Text>
        </View>

        <View style={[styles.tabContainer, isDarkMode && styles.tabContainerDark]}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => {
              setMode('login');
              setError('');
            }}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Giriş Yap
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, mode === 'signup' && styles.tabActive]}
            onPress={() => {
              setMode('signup');
              setError('');
            }}
          >
            <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
              Kayıt Ol
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.demoContainer, isDarkMode && styles.demoContainerDark]}>
          <Text style={[styles.demoText, isDarkMode && styles.demoTextDark]}>
            📱 Demo Hesapları ile Giriş:
          </Text>
          <TouchableOpacity
            style={[styles.demoButton, styles.demoBuyerButton]}
            onPress={() => handleDemoLogin('alici@sipariskutusu.demo', 'Demo123!', 'buyer')}
          >
            <Text style={styles.demoButtonText}>Alıcı Olarak Giriş</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.demoButton, styles.demoSellerButton]}
            onPress={() => handleDemoLogin('satici@sipariskutusu.demo', 'Demo123!', 'seller')}
          >
            <Text style={styles.demoButtonText}>Satıcı Olarak Giriş</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isDarkMode && styles.labelDark]}>Ad Soyad</Text>
              <TextInput
                style={[styles.input, isDarkMode && styles.inputDark]}
                placeholder="Adınız ve Soyadınız"
                placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
                value={fullName}
                onChangeText={setFullName}
                editable={!isLoading}
              />
            </View>
          )}

          <View style={styles.inputContainer}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Email</Text>
            <TextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              placeholder="ornek@email.com"
              placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, isDarkMode && styles.labelDark]}>Şifre</Text>
            <TextInput
              style={[styles.input, isDarkMode && styles.inputDark]}
              placeholder="••••••••"
              placeholderTextColor={isDarkMode ? '#666666' : '#999999'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          {mode === 'signup' && (
            <View style={styles.inputContainer}>
              <Text style={[styles.label, isDarkMode && styles.labelDark]}>Hesap Tipi</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    borderWidth: 2,
                    borderColor: accountRole === 'buyer' ? '#3B82F6' : '#E5E7EB',
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: accountRole === 'buyer' ? '#EFF6FF' : 'transparent',
                  }}
                  onPress={() => setAccountRole('buyer')}
                >
                  <Text
                    style={{
                      color: accountRole === 'buyer' ? '#3B82F6' : '#999999',
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    Alıcı
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    borderWidth: 2,
                    borderColor: accountRole === 'seller' ? '#8B5CF6' : '#E5E7EB',
                    borderRadius: 8,
                    paddingVertical: 12,
                    alignItems: 'center',
                    backgroundColor: accountRole === 'seller' ? '#FAF5FF' : 'transparent',
                  }}
                  onPress={() => setAccountRole('seller')}
                >
                  <Text
                    style={{
                      color: accountRole === 'seller' ? '#8B5CF6' : '#999999',
                      fontWeight: '600',
                      fontSize: 14,
                    }}
                  >
                    Satıcı
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {error && <Text style={styles.errorText}>⚠️ {error}</Text>}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleAuth}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
