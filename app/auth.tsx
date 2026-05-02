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
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';
import { trackEvent } from '../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../src/constants/telemetryEvents';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardRoot: {
    flex: 1,
  },
  containerDark: {
    backgroundColor: '#0A0A0A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  scrollContentCompact: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contentInner: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  mascotContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  mascotHint: {
    marginTop: 6,
    fontSize: 11,
    color: '#5B6B80',
    fontWeight: '600',
    textAlign: 'center',
  },
  mascotHintDark: {
    color: '#A5B4C8',
  },
  brandWordmark: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 40,
    letterSpacing: -1.0,
    textAlign: 'center',
  },
  brandWordmarkFirst: {
    color: '#0D2347',
  },
  brandWordmarkFirstDark: {
    color: '#E5EEFF',
  },
  brandWordmarkSecond: {
    color: '#1E5FC6',
  },
  brandBoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  brandLine: {
    width: 52,
    height: 2,
    borderRadius: 999,
    backgroundColor: '#1E5FC6',
  },
  brandBoText: {
    color: '#1E5FC6',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    marginHorizontal: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  subtitleDark: {
    color: '#999999',
  },
  formContainer: {
    marginBottom: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
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
    marginBottom: 10,
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
    padding: 10,
    marginBottom: 12,
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
  themeToggleDark: {
    backgroundColor: '#2A2A2A',
  },
});

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { isDarkMode, toggleDarkMode, signInWithPassword, signUpWithPassword, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [accountRole, setAccountRole] = useState<'buyer' | 'seller'>('buyer');
  const redirectPath = typeof params.redirect === 'string' && params.redirect.trim().startsWith('/')
    ? params.redirect.trim()
    : '/(tabs)';
  const isCompactScreen = height < 760 || width < 360;
  const mascotSize = isCompactScreen ? 78 : 90;

  const handleAuth = async () => {
    try {
      setError('');
      if (!email || !password) {
        setError('Tüm alanları doldurunuz');
        return;
      }

      if (mode === 'login') {
        await signInWithPassword(email, password);
        trackEvent(TELEMETRY_EVENTS.USER_SIGNED_IN, { method: 'email', account_role: null });
        router.replace(redirectPath as never);
      } else {
        if (!fullName) {
          setError('Ad Soyad gereklidir');
          return;
        }
        await signUpWithPassword(email, password, fullName, accountRole);
        trackEvent(TELEMETRY_EVENTS.USER_SIGNED_UP, { method: 'email', account_role: accountRole });
        router.replace(redirectPath as never);
      }
    } catch (err: any) {
      setError(err?.message || 'Bir hata oluştu');
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string, role: 'buyer' | 'seller') => {
    try {
      setError('');
      await signInWithPassword(demoEmail, demoPassword);
      trackEvent(TELEMETRY_EVENTS.USER_SIGNED_IN, { method: 'demo', account_role: role });
      router.replace(redirectPath as never);
    } catch (err: any) {
      setError(`Demo giriş başarısız: ${err?.message}`);
    }
  };

  return (
    <SafeAreaView style={[styles.container, isDarkMode && styles.containerDark]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardRoot}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, isCompactScreen && styles.scrollContentCompact]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.contentInner}>
        <View style={styles.logoContainer}>
          <Text style={[styles.brandWordmark, isCompactScreen && { fontSize: 28, lineHeight: 35 }]}>
            <Text style={[styles.brandWordmarkFirst, isDarkMode && styles.brandWordmarkFirstDark]}>Sipariş </Text>
            <Text style={styles.brandWordmarkSecond}>kutusu</Text>
          </Text>
          <View style={styles.brandBoRow}>
            <View style={styles.brandLine} />
            <Text style={styles.brandBoText}>BO</Text>
            <View style={styles.brandLine} />
          </View>
          <Text style={[styles.subtitle, isDarkMode && styles.subtitleDark]}>
            Güvenli Alışveriş Pazaryeri
          </Text>
        </View>

        <View style={styles.mascotContainer}>
          <BoxMascot variant="welcome" size={mascotSize} animated />
          <Text style={[styles.mascotHint, isDarkMode && styles.mascotHintDark]}>
            BO seni karşılıyor. Giriş yapıp vitrine ya da alışverişe devam edebilirsin.
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

          {mode === 'signup' && (
            <View style={{ marginTop: 16, paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 11, color: '#6B7280', textAlign: 'center', lineHeight: 18 }}>
                Kayıt olarak{' '}
                <Text
                  style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '600' }}
                  onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } })}
                >
                  Kullanım Şartları
                </Text>
                {' '}ve{' '}
                <Text
                  style={{ color: '#3B82F6', textDecorationLine: 'underline', fontWeight: '600' }}
                  onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy-kvkk' } })}
                >
                  Gizlilik Politikası (KVKK)
                </Text>
                {'\u2019nı okuduğunuzu ve kabul ettiğinizi onaylarsınız.'}
              </Text>
            </View>
          )}

          {mode === 'login' && (
            <View style={{ marginTop: 16, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
              <Text
                style={{ fontSize: 11, color: '#3B82F6', textDecorationLine: 'underline' }}
                onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } })}
              >
                Kullanım Şartları
              </Text>
              <Text style={{ fontSize: 11, color: '#D1D5DB', paddingHorizontal: 4 }}>·</Text>
              <Text
                style={{ fontSize: 11, color: '#3B82F6', textDecorationLine: 'underline' }}
                onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy-kvkk' } })}
              >
                Gizlilik & KVKK
              </Text>
              <Text style={{ fontSize: 11, color: '#D1D5DB', paddingHorizontal: 4 }}>·</Text>
              <Text
                style={{ fontSize: 11, color: '#3B82F6', textDecorationLine: 'underline' }}
                onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'platform-liability' } })}
              >
                Sorumluluk
              </Text>
            </View>
          )}
        </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
