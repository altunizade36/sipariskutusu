import React, { useState } from 'react';
import {
  View,
  Text,
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';
import { trackEvent } from '../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../src/constants/telemetryEvents';
import { fonts } from '../src/constants/theme';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ redirect?: string }>();
  const { isDarkMode, signInWithPassword, signUpWithPassword, isLoading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [accountRole, setAccountRole] = useState<'buyer' | 'seller'>('buyer');
  const redirectPath =
    typeof params.redirect === 'string' && params.redirect.trim().startsWith('/')
      ? params.redirect.trim()
      : '/(tabs)';
  const isCompact = height < 760 || width < 360;
  const mascotSize = isCompact ? 72 : 88;

  const bgTop: [string, string, string] = isDarkMode
    ? ['#0D1B38', '#0F2454', '#132B60']
    : ['#1E5FC6', '#2D6FD4', '#3B82F6'];
  const bgBottom = isDarkMode ? '#0A0A0A' : '#F4F8FF';
  const cardBg = isDarkMode ? '#141414' : '#FFFFFF';
  const textPrimary = isDarkMode ? '#F0F5FF' : '#0D2347';
  const textSecondary = isDarkMode ? '#8BA0C0' : '#5B6B80';
  const inputBg = isDarkMode ? '#1C1C1C' : '#F8FAFF';
  const inputBorder = isDarkMode ? '#2A3A55' : '#D1DCF0';
  const inputText = isDarkMode ? '#FFFFFF' : '#0D2347';
  const placeholderColor = isDarkMode ? '#445A7A' : '#9AADC5';
  const dividerColor = isDarkMode ? '#1E2E44' : '#E2EAFA';

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
    <SafeAreaView style={{ flex: 1, backgroundColor: bgBottom }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Top gradient hero ────────────────────────────────────────────── */}
          <LinearGradient
            colors={bgTop}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{
              alignItems: 'center',
              paddingTop: isCompact ? 20 : 32,
              paddingBottom: 36,
              paddingHorizontal: 24,
            }}
          >
            {/* Decorative ring behind mascot */}
            <View
              style={{
                width: mascotSize + 32,
                height: mascotSize + 32,
                borderRadius: (mascotSize + 32) / 2,
                backgroundColor: 'rgba(255,255,255,0.12)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  width: mascotSize + 12,
                  height: mascotSize + 12,
                  borderRadius: (mascotSize + 12) / 2,
                  backgroundColor: 'rgba(255,255,255,0.18)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BoxMascot variant="welcome" size={mascotSize} animated />
              </View>
            </View>

            {/* Brand */}
            <Text
              style={{
                fontFamily: fonts.headingBold,
                fontSize: isCompact ? 26 : 30,
                color: '#FFFFFF',
                letterSpacing: -0.5,
              }}
            >
              Sipariş{' '}
              <Text style={{ color: 'rgba(255,255,255,0.75)' }}>kutusu</Text>
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
                gap: 8,
              }}
            >
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <View
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 20,
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.25)',
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 10,
                    color: 'rgba(255,255,255,0.9)',
                    letterSpacing: 2,
                  }}
                >
                  GÜVENLİ ALIŞVERİŞ
                </Text>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </View>
          </LinearGradient>

          {/* ── Form card ────────────────────────────────────────────────────── */}
          <View style={{ flex: 1, backgroundColor: bgBottom, paddingHorizontal: 16, paddingTop: 0 }}>
            <View
              style={{
                backgroundColor: cardBg,
                borderRadius: 24,
                marginTop: -20,
                paddingHorizontal: 20,
                paddingTop: 24,
                paddingBottom: 20,
                shadowColor: '#1E5FC6',
                shadowOpacity: 0.08,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: -4 },
                elevation: 8,
              }}
            >
              {/* Tab selector */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isDarkMode ? '#1A1A1A' : '#F0F5FF',
                  borderRadius: 14,
                  padding: 4,
                  marginBottom: 20,
                }}
              >
                {(['login', 'signup'] as AuthMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => { setMode(m); setError(''); }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 11,
                      alignItems: 'center',
                      backgroundColor: mode === m
                        ? (isDarkMode ? '#1E5FC6' : '#1E5FC6')
                        : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 13,
                        color: mode === m ? '#FFFFFF' : textSecondary,
                      }}
                    >
                      {m === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Demo login box */}
              <View
                style={{
                  backgroundColor: isDarkMode ? '#0D1B38' : '#EFF6FF',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 18,
                  borderWidth: 1,
                  borderColor: isDarkMode ? '#1E3A6E' : '#BFDBFE',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Ionicons name="phone-portrait-outline" size={13} color={isDarkMode ? '#93C5FD' : '#1E5FC6'} />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 12,
                      color: isDarkMode ? '#93C5FD' : '#1E5FC6',
                    }}
                  >
                    Demo Hesapları ile Hızlı Giriş
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => handleDemoLogin('alici@sipariskutusu.demo', 'Demo123!', 'buyer')}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: '#1E5FC6',
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                      Alıcı Girişi
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDemoLogin('satici@sipariskutusu.demo', 'Demo123!', 'seller')}
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: '#7C3AED',
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>
                      Satıcı Girişi
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Divider */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 10 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: dividerColor }} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: textSecondary }}>
                  veya e-posta ile devam et
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: dividerColor }} />
              </View>

              {/* Fields */}
              {mode === 'signup' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textSecondary, marginBottom: 6 }}>
                    Ad Soyad
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: inputBg,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: inputBorder,
                      paddingHorizontal: 12,
                      height: 48,
                    }}
                  >
                    <Ionicons name="person-outline" size={16} color={placeholderColor} style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: inputText }}
                      placeholder="Adınız ve Soyadınız"
                      placeholderTextColor={placeholderColor}
                      value={fullName}
                      onChangeText={setFullName}
                      editable={!isLoading}
                    />
                  </View>
                </View>
              )}

              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textSecondary, marginBottom: 6 }}>
                  E-posta
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: inputBg,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: inputBorder,
                    paddingHorizontal: 12,
                    height: 48,
                  }}
                >
                  <Ionicons name="mail-outline" size={16} color={placeholderColor} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: inputText }}
                    placeholder="ornek@email.com"
                    placeholderTextColor={placeholderColor}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textSecondary, marginBottom: 6 }}>
                  Şifre
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: inputBg,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: inputBorder,
                    paddingHorizontal: 12,
                    height: 48,
                  }}
                >
                  <Ionicons name="lock-closed-outline" size={16} color={placeholderColor} style={{ marginRight: 8 }} />
                  <TextInput
                    style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: inputText }}
                    placeholder="••••••••"
                    placeholderTextColor={placeholderColor}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={placeholderColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Account role picker (signup only) */}
              {mode === 'signup' && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: textSecondary, marginBottom: 8 }}>
                    Hesap Tipi
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {([
                      { key: 'buyer', label: 'Alıcı', icon: 'bag-outline', color: '#1E5FC6', tint: '#EFF6FF', tintDark: '#0D1B38' },
                      { key: 'seller', label: 'Satıcı', icon: 'storefront-outline', color: '#7C3AED', tint: '#FAF5FF', tintDark: '#1A0E38' },
                    ] as const).map((r) => {
                      const active = accountRole === r.key;
                      return (
                        <TouchableOpacity
                          key={r.key}
                          onPress={() => setAccountRole(r.key)}
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            paddingVertical: 11,
                            borderRadius: 12,
                            borderWidth: 2,
                            borderColor: active ? r.color : dividerColor,
                            backgroundColor: active
                              ? (isDarkMode ? r.tintDark : r.tint)
                              : 'transparent',
                          }}
                        >
                          <Ionicons name={r.icon} size={15} color={active ? r.color : placeholderColor} />
                          <Text
                            style={{
                              fontFamily: fonts.bold,
                              fontSize: 13,
                              color: active ? r.color : textSecondary,
                            }}
                          >
                            {r.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Error */}
              {!!error && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FEF2F2',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: '#FECACA',
                  }}
                >
                  <Ionicons name="warning-outline" size={14} color="#EF4444" />
                  <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#DC2626', flex: 1 }}>
                    {error}
                  </Text>
                </View>
              )}

              {/* Submit button */}
              <TouchableOpacity
                onPress={handleAuth}
                disabled={isLoading}
                style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 12 }}
              >
                <LinearGradient
                  colors={['#1E5FC6', '#3B82F6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    height: 50,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isLoading ? 0.6 : 1,
                  }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.3 }}>
                      {mode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {/* Legal links */}
              {mode === 'signup' ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: textSecondary, textAlign: 'center', lineHeight: 18 }}>
                  Kayıt olarak{' '}
                  <Text
                    style={{ color: '#1E5FC6', textDecorationLine: 'underline', fontFamily: fonts.medium }}
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms-of-use' } })}
                  >
                    Kullanım Şartları
                  </Text>
                  {' '}ve{' '}
                  <Text
                    style={{ color: '#1E5FC6', textDecorationLine: 'underline', fontFamily: fonts.medium }}
                    onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy-kvkk' } })}
                  >
                    Gizlilik Politikası
                  </Text>
                  {'\u2019nı kabul etmiş olursunuz.'}
                </Text>
              ) : (
                <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 4 }}>
                  {[
                    { label: 'Kullanım Şartları', doc: 'terms-of-use' },
                    { label: 'Gizlilik & KVKK', doc: 'privacy-kvkk' },
                    { label: 'Sorumluluk', doc: 'platform-liability' },
                  ].map((link, i, arr) => (
                    <React.Fragment key={link.doc}>
                      <Text
                        style={{ fontFamily: fonts.medium, fontSize: 11, color: '#1E5FC6', textDecorationLine: 'underline' }}
                        onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: link.doc } })}
                      >
                        {link.label}
                      </Text>
                      {i < arr.length - 1 && (
                        <Text style={{ fontSize: 11, color: dividerColor, paddingHorizontal: 2 }}>·</Text>
                      )}
                    </React.Fragment>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
