import { useEffect, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';
import {
  applyRecommendedSecurity,
  changePassword,
  closeOtherSessions,
  closeSession,
  getPasswordAgeInDays,
  getRiskySessionCount,
  getSecurityStatusLabel,
  loadSecurityState,
  persistSecurityState,
  runSecurityScan,
  setTransactionPin,
  type SecurityEvent,
  type SecurityState,
} from '../src/services/securityService';

const AUTO_LOGOUT_OPTIONS: Array<15 | 30 | 60 | 120 | 0> = [15, 30, 60, 120, 0];

function getSeverityColor(severity: SecurityEvent['severity']) {
  if (severity === 'high') return colors.danger;
  if (severity === 'medium') return '#D97706';
  return colors.success;
}

function getScoreColor(score: number) {
  if (score >= 85) return colors.success;
  if (score >= 70) return '#D97706';
  if (score >= 50) return '#F97316';
  return colors.danger;
}

function formatLastScan(lastScanAt: string | null) {
  if (!lastScanAt) {
    return 'Henüz taranmadı';
  }

  return new Date(lastScanAt).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ToggleRow({
  icon,
  color,
  label,
  desc,
  value,
  onChange,
  disabled,
  isLast,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  color: string;
  label: string;
  desc: string;
  value: boolean;
  onChange: (nextValue: boolean) => void;
  disabled?: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.borderLight,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View
        style={{
          backgroundColor: `${color}18`,
          width: 36,
          height: 36,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{label}</Text>
        <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{desc}</Text>
      </View>
      <Switch
        disabled={disabled}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#D1D5DB', true: `${colors.primary}80` }}
        thumbColor={value ? colors.primary : '#9CA3AF'}
      />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: fonts.bold,
        fontSize: 11,
        color: colors.textSecondary,
        marginLeft: 4,
        marginBottom: 8,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

function Card({ children, marginBottom = 20 }: { children: React.ReactNode; marginBottom?: number }) {
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.borderLight,
        overflow: 'hidden',
        marginBottom,
      }}
    >
      {children}
    </View>
  );
}

export default function SecurityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [securityState, setSecurityState] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      if (!user) {
        if (mounted) {
          setLoading(false);
        }
        return;
      }

      try {
        const nextState = await loadSecurityState();
        if (mounted) {
          setSecurityState(nextState);
        }
      } catch {
        if (mounted) {
          Alert.alert('Hata', 'Güvenlik ayarları yüklenemedi.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    hydrate();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeout = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);

  if (!user) {
    return (
      <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
        <View className="flex-1 px-5 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center">
            <Ionicons name="lock-closed-outline" size={30} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: colors.textPrimary, marginTop: 16 }}>
            Giriş Gerekli
          </Text>
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}
          >
            Güvenlik ayarlarını görüntülemek için önce giriş yapman gerekiyor.
          </Text>

          <View className="w-full mt-6 gap-2">
            <Pressable
              onPress={() => router.replace('/auth')}
              style={{ backgroundColor: colors.primary }}
              className="h-12 rounded-xl items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
                Giriş Yap
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}
              className="h-12 rounded-xl border items-center justify-center"
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.primary }}>
                Geri Dön
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  async function commitState(
    updater: (current: SecurityState) => SecurityState | Promise<SecurityState>,
    successMessage?: string,
  ) {
    if (!securityState) {
      return;
    }

    try {
      setWorking(true);
      const nextState = await updater(securityState);
      setSecurityState(nextState);
      if (successMessage) {
        setToast(successMessage);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.';
      Alert.alert('Hata', message);
    } finally {
      setWorking(false);
    }
  }

  function closePasswordModal() {
    setPwError('');
    setCurrentPw('');
    setNewPw('');
    setConfirmPw('');
    setShowPasswordModal(false);
  }

  async function handleSavePassword() {
    if (!currentPw.trim()) {
      setPwError('Mevcut şifreyi girin.');
      return;
    }

    if (newPw.length < 8) {
      setPwError('Yeni şifre en az 8 karakter olmalı.');
      return;
    }

    if (newPw !== confirmPw) {
      setPwError('Yeni şifreler eşleşmiyor.');
      return;
    }

    try {
      setWorking(true);
      const nextState = await changePassword(currentPw, newPw);
      setSecurityState(nextState);
      closePasswordModal();
      setToast('Şifre başarıyla güncellendi.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Şifre güncellenemedi.';
      setPwError(message);
    } finally {
      setWorking(false);
    }
  }

  if (loading || !securityState) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={{ fontFamily: fonts.medium, color: colors.textSecondary, marginTop: 12 }}>
            Güvenlik ayarları yükleniyor...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const passwordAge = getPasswordAgeInDays(securityState.passwordChangedAt);
  const riskySessions = getRiskySessionCount(securityState);
  const otherSessions = securityState.sessions.filter((session) => !session.current);
  const scoreColor = getScoreColor(securityState.securityScore);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }} edges={['top']}>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.borderLight,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: '#fff',
        }}
      >
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }}>Güvenlik</Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Card>
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>Güvenlik Skoru</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 4 }}>
                  Son tarama: {formatLastScan(securityState.lastScanAt)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, color: scoreColor }}>
                  {securityState.securityScore}
                </Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: scoreColor }}>
                  {getSecurityStatusLabel(securityState.securityScore)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 14, height: 8, borderRadius: 999, backgroundColor: '#E5E7EB', overflow: 'hidden' }}>
              <View style={{ width: `${securityState.securityScore}%`, backgroundColor: scoreColor, height: '100%' }} />
            </View>

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <Pressable
                disabled={working}
                onPress={() => commitState(() => runSecurityScan(), 'Güvenlik taraması tamamlandı.')}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: '#EFF6FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 8,
                  opacity: working ? 0.6 : 1,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.primary }}>Taramayı Çalıştır</Text>
              </Pressable>
              <Pressable
                disabled={working}
                onPress={() => commitState(() => applyRecommendedSecurity(), 'Önerilen güvenlikler uygulandı.')}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  backgroundColor: colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: working ? 0.6 : 1,
                }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Önerilenleri Uygula</Text>
              </Pressable>
            </View>
          </View>
        </Card>

        <SectionTitle>Şifre ve Kimlik</SectionTitle>
        <Card>
          <Pressable
            onPress={() => setShowPasswordModal(true)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}
          >
            <View style={{ backgroundColor: '#EFF6FF', width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Şifre Değiştir</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                {passwordAge === null ? 'Henüz şifre güncellemesi yapılmadı' : `${passwordAge} gündür aynı şifre kullanılıyor`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>

          <ToggleRow
            icon="finger-print-outline"
            color="#059669"
            label="Passkey / Geçiş Anahtarı"
            desc="Cihaza bağlı hızlı ve şifresiz giriş tercihleri"
            value={securityState.passkeyEnabled}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, passkeyEnabled: nextValue }),
                nextValue ? 'Geçiş anahtarı etkinleştirildi.' : 'Geçiş anahtarı kapatıldı.',
              )
            }
            isLast
          />
        </Card>

        <SectionTitle>Hesap Güvenliği</SectionTitle>
        <Card>
          <ToggleRow
            icon="shield-checkmark-outline"
            color="#7C3AED"
            label="İki Adımlı Doğrulama (2FA)"
            desc="SMS doğrulama kodu ile giriş güvenliği"
            value={securityState.twoFactor}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, twoFactor: nextValue }),
                nextValue ? '2FA etkinleştirildi.' : '2FA devre dışı bırakıldı.',
              )
            }
          />
          <ToggleRow
            icon="phone-portrait-outline"
            color="#2563EB"
            label="Yeni Cihaz Onayı"
            desc="Yeni cihazdan girişte ek onay iste"
            value={securityState.newDeviceApproval}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, newDeviceApproval: nextValue }),
                nextValue ? 'Yeni cihaz onayı açıldı.' : 'Yeni cihaz onayı kapatıldı.',
              )
            }
          />
          <ToggleRow
            icon="scan-outline"
            color="#059669"
            label="Biyometrik Giriş"
            desc="Parmak izi veya yüz tanıma ile giriş"
            value={securityState.biometric}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, biometric: nextValue }),
                nextValue ? 'Biyometrik giriş açık.' : 'Biyometrik giriş kapalı.',
              )
            }
            isLast
          />
        </Card>

        <SectionTitle>İleri Koruma</SectionTitle>
        <Card>
          <ToggleRow
            icon="lock-closed-outline"
            color="#DC2626"
            label="Brute-Force Koruması"
            desc="Başarısız giriş denemelerini daha agresif sınırla"
            value={securityState.bruteForceProtection}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, bruteForceProtection: nextValue }),
                nextValue ? 'Brute-force koruması açıldı.' : 'Brute-force koruması kapatıldı.',
              )
            }
          />
          <ToggleRow
            icon="card-outline"
            color="#7C2D12"
            label="İşlem PINi"
            desc="Ödeme onaylarında ek PIN sor"
            value={securityState.transactionPinEnabled}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                () => setTransactionPin(nextValue),
                nextValue ? 'İşlem PINi etkinleştirildi.' : 'İşlem PINi kapatıldı.',
              )
            }
          />
          <ToggleRow
            icon="location-outline"
            color="#0F766E"
            label="Konum Kilidi"
            desc="Şüpheli şehir veya bölge girişlerini işaretle"
            value={securityState.locationLock}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, locationLock: nextValue }),
                nextValue ? 'Konum kilidi açıldı.' : 'Konum kilidi kapatıldı.',
              )
            }
          />

          <View style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Pasif Oturumları Kapat</Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              Belirlediğin sürede hareketsiz kalan oturumlar otomatik kapatılsın
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {AUTO_LOGOUT_OPTIONS.map((option) => {
                const active = securityState.autoLogoutMinutes === option;

                return (
                  <Pressable
                    key={option}
                    disabled={working}
                    onPress={() =>
                      commitState(
                        (current) => persistSecurityState({ ...current, autoLogoutMinutes: option }),
                        option === 0 ? 'Otomatik oturum kapatma kapatıldı.' : `${option} dakikalık auto logout seçildi.`,
                      )
                    }
                    style={{
                      height: 34,
                      paddingHorizontal: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? colors.primary : colors.borderDefault,
                      backgroundColor: active ? '#EFF6FF' : '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 8,
                      marginBottom: 8,
                      opacity: working ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: active ? colors.primary : colors.textPrimary }}>
                      {option === 0 ? 'Kapalı' : `${option} dk`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <SectionTitle>Güvenlik Bildirimleri</SectionTitle>
        <Card>
          <ToggleRow
            icon="notifications-outline"
            color="#D97706"
            label="Giriş Uyarısı"
            desc="Yeni cihazdan girişte bildirim gönder"
            value={securityState.loginAlert}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, loginAlert: nextValue }),
                nextValue ? 'Giriş uyarısı açık.' : 'Giriş uyarısı kapalı.',
              )
            }
          />
          <ToggleRow
            icon="mail-outline"
            color="#2563EB"
            label="E-posta Uyarıları"
            desc="Giriş, şifre ve sipariş güvenlik olaylarını e-postala"
            value={securityState.emailAlert}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, emailAlert: nextValue }),
                nextValue ? 'E-posta uyarıları açıldı.' : 'E-posta uyarıları kapatıldı.',
              )
            }
          />
          <ToggleRow
            icon="chatbubble-ellipses-outline"
            color="#0891B2"
            label="SMS Uyarıları"
            desc="Riskli giriş ve ödeme onaylarını SMS ile bildir"
            value={securityState.smsAlert}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, smsAlert: nextValue }),
                nextValue ? 'SMS uyarıları açıldı.' : 'SMS uyarıları kapatıldı.',
              )
            }
            isLast
          />
        </Card>

        <SectionTitle>Hesap Kurtarma</SectionTitle>
        <Card>
          <ToggleRow
            icon="mail-open-outline"
            color="#7C3AED"
            label="Kurtarma E-postası"
            desc="Şifre sıfırlama akışında e-posta geri kazanımı kullan"
            value={securityState.recoveryEmail}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, recoveryEmail: nextValue }),
                nextValue ? 'Kurtarma e-postası açıldı.' : 'Kurtarma e-postası kapatıldı.',
              )
            }
          />
          <ToggleRow
            icon="call-outline"
            color="#059669"
            label="Kurtarma SMSi"
            desc="Şifre sıfırlama akışında SMS geri kazanımı kullan"
            value={securityState.recoverySms}
            disabled={working}
            onChange={(nextValue) =>
              commitState(
                (current) => persistSecurityState({ ...current, recoverySms: nextValue }),
                nextValue ? 'Kurtarma SMSi açıldı.' : 'Kurtarma SMSi kapatıldı.',
              )
            }
            isLast
          />
        </Card>

        <SectionTitle>Güvenlik Olayları</SectionTitle>
        <Card marginBottom={12}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderLight }}>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1, marginRight: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.danger }}>{securityState.failedAttempts24h}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>Başarısız giriş / 24 saat</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8, backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12 }}>
                <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: '#EA580C' }}>{riskySessions}</Text>
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>Riskli oturum</Text>
              </View>
            </View>
          </View>

          {securityState.events.map((event, index) => (
            <View
              key={event.id}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: index === securityState.events.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: getSeverityColor(event.severity),
                  marginTop: 5,
                  marginRight: 10,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{event.title}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                  {event.description}
                </Text>
              </View>
            </View>
          ))}
        </Card>

        <SectionTitle>{`Aktif Oturumlar (${securityState.sessions.length})`}</SectionTitle>
        <Card marginBottom={10}>
          {securityState.sessions.map((session, index) => (
            <View
              key={session.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: index === securityState.sessions.length - 1 ? 0 : 1,
                borderBottomColor: colors.borderLight,
              }}
            >
              <View style={{ backgroundColor: '#EFF6FF', width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons
                  name={session.device.includes('iPhone') ? 'phone-portrait-outline' : session.device.includes('Mac') ? 'laptop-outline' : 'globe-outline'}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>{session.device}</Text>
                <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                  {session.location} · {session.lastSeen}
                </Text>
              </View>

              {session.current ? (
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: '#065F46' }}>Aktif</Text>
                </View>
              ) : (
                <Pressable
                  disabled={working}
                  onPress={() => {
                    Alert.alert('Oturumu Sonlandır', 'Bu cihazın erişimini kapatmak istediğinize emin misiniz?', [
                      { text: 'Vazgeç', style: 'cancel' },
                      {
                        text: 'Kapat',
                        style: 'destructive',
                        onPress: () => commitState(() => closeSession(session.id), 'Oturum sonlandırıldı.'),
                      },
                    ]);
                  }}
                >
                  <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: session.risk === 'review' ? colors.danger : colors.primary }}>
                    {session.risk === 'review' ? 'İncele' : 'Kapat'}
                  </Text>
                </Pressable>
              )}
            </View>
          ))}
        </Card>

        {otherSessions.length > 0 ? (
          <Pressable
            disabled={working}
            onPress={() => {
              Alert.alert('Tüm Cihazlardan Çık', 'Mevcut cihaz hariç tüm oturumlar kapatılacak.', [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Kapat',
                  style: 'destructive',
                  onPress: () => commitState(() => closeOtherSessions(), 'Diğer tüm oturumlar kapatıldı.'),
                },
              ]);
            }}
            style={{
              marginBottom: 20,
              borderWidth: 1,
              borderColor: '#FECACA',
              backgroundColor: '#FEF2F2',
              borderRadius: 12,
              height: 42,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              opacity: working ? 0.6 : 1,
            }}
          >
            <Ionicons name="power-outline" size={14} color={colors.danger} />
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.danger, marginLeft: 6 }}>Diğer Tüm Oturumları Kapat</Text>
          </Pressable>
        ) : null}

        <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#FECACA', overflow: 'hidden' }}>
          <Pressable
            onPress={() => {
              Alert.alert('Hesabı Sil', 'Tüm verileriniz kalıcı olarak silinecek. Bu işlem geri alınamaz.', [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Sil',
                  style: 'destructive',
                  onPress: () => setToast('Hesap silme talebiniz alındı. Destek ekibi sizinle iletişime geçecek.'),
                },
              ]);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <View style={{ backgroundColor: '#FEE2E2', width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.danger }}>Hesabı Sil</Text>
              <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>Tüm veriler kalıcı olarak silinir</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.danger} />
          </Pressable>
        </View>
      </ScrollView>

      {toast ? (
        <View style={{ position: 'absolute', bottom: 24, left: 16, right: 16, backgroundColor: '#111827', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: '#fff', textAlign: 'center' }}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={showPasswordModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <Pressable style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'flex-end' }} onPress={closePasswordModal}>
          <Pressable style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 17, color: colors.textPrimary, flex: 1 }}>Şifre Değiştir</Text>
              <Pressable onPress={closePasswordModal}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {pwError ? (
              <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.danger }}>{pwError}</Text>
              </View>
            ) : null}

            {([
              { label: 'Mevcut Şifre', value: currentPw, onChange: setCurrentPw },
              { label: 'Yeni Şifre', value: newPw, onChange: setNewPw },
              { label: 'Yeni Şifre (Tekrar)', value: confirmPw, onChange: setConfirmPw },
            ] as const).map((field) => (
              <View key={field.label} style={{ marginBottom: 14 }}>
                <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>{field.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F7F7', borderRadius: 12, borderWidth: 1, borderColor: colors.borderDefault, paddingHorizontal: 12, height: 48 }}>
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    secureTextEntry
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, marginLeft: 8, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}
                  />
                </View>
              </View>
            ))}

            <Pressable
              disabled={working}
              onPress={handleSavePassword}
              style={{
                backgroundColor: colors.primary,
                borderRadius: 14,
                height: 50,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 4,
                opacity: working ? 0.6 : 1,
              }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: '#fff' }}>Kaydet</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
