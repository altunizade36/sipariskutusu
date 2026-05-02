import { ActivityIndicator, Alert, Image, View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadAvatar } from '../src/services/profileService';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { fetchMyProfile, updateProfile, updateProfileEmail } from '../src/services/profileService';
import { captureError } from '../src/services/monitoring';
import { isSupabaseConfigured } from '../src/services/supabase';
import { useAuth } from '../src/context/AuthContext';
import BoxMascot from '../src/components/BoxMascot';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, isDarkMode } = useAuth();

  const authName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const authEmail = user?.email ?? '';

  const [orig, setOrig] = useState<{
    name: string;
    username: string;
    email: string;
    bio: string;
    phone: string;
    birth: string;
    gender: 'Kadın' | 'Erkek' | 'Belirtmem';
  }>({
    name: authName || '',
    username: '',
    email: authEmail,
    bio: '',
    phone: '',
    birth: '',
    gender: 'Belirtmem',
  });

  const [name, setName] = useState(orig.name);
  const [username, setUsername] = useState(orig.username);
  const [email, setEmail] = useState(orig.email);
  const [bio, setBio] = useState(orig.bio);
  const [phone, setPhone] = useState(orig.phone);
  const [birth, setBirth] = useState(orig.birth);
  const [gender, setGender] = useState<'Kadın' | 'Erkek' | 'Belirtmem'>(orig.gender as 'Kadın');
  const [toast, setToast] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const palette = useMemo(() => ({
    screenBg: isDarkMode ? '#0F172A' : '#F7F7F7',
    surfaceBg: isDarkMode ? '#111827' : '#FFFFFF',
    inputBg: isDarkMode ? '#0F172A' : '#FFFFFF',
    infoBg: isDarkMode ? '#1E293B' : '#FFF7ED',
    infoBorder: isDarkMode ? '#334155' : '#FED7AA',
    mutedBg: isDarkMode ? '#1F2937' : '#F1F5F9',
    border: isDarkMode ? '#334155' : colors.borderDefault,
    borderLight: isDarkMode ? '#334155' : colors.borderLight,
    textPrimary: isDarkMode ? '#E5E7EB' : colors.textPrimary,
    textSecondary: isDarkMode ? '#94A3B8' : colors.textSecondary,
    textMuted: isDarkMode ? '#94A3B8' : colors.textMuted,
  }), [isDarkMode]);

  const isDirty =
    name !== orig.name ||
    username !== orig.username ||
    email !== orig.email ||
    bio !== orig.bio ||
    phone !== orig.phone ||
    birth !== orig.birth ||
    gender !== orig.gender;

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      return;
    }

    let active = true;

    setLoading(true);
    fetchMyProfile()
      .then((profile) => {
        if (!active || !profile) {
          return;
        }

        const profileGender = (profile.gender === 'Kadın' || profile.gender === 'Erkek' || profile.gender === 'Belirtmem')
          ? profile.gender as 'Kadın' | 'Erkek' | 'Belirtmem'
          : 'Belirtmem' as const;

        const nextOrig = {
          name: profile.full_name?.trim() || 'Kullanıcı',
          username: profile.username ? `@${profile.username.replace(/^@+/, '')}` : '',
          email: user?.email ?? authEmail,
          bio: profile.bio?.trim() || '',
          phone: profile.phone?.trim() || '',
          birth: profile.birth_date?.trim() || '',
          gender: profileGender,
        };

        setOrig(nextOrig);
        setName(nextOrig.name);
        setUsername(nextOrig.username);
        setEmail(nextOrig.email);
        setBio(nextOrig.bio);
        setPhone(nextOrig.phone);
        setBirth(nextOrig.birth);
        setGender(nextOrig.gender);
        setAvatarUrl(profile.avatar_url ?? null);
      })
      .catch((error) => {
        captureError(error, { scope: 'profile_edit_load' });
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [authEmail, user?.email]);

  const completeness = useMemo(() => {
    const fields = [name, username, email, bio, phone, birth, gender];
    const filled = fields.filter((f) => f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [name, username, email, bio, phone, birth, gender]);

  if (!user) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: palette.screenBg }} edges={['top']}>
        <View className="flex-1 px-5 items-center justify-center">
          <View className="w-16 h-16 rounded-full bg-[#DBEAFE] items-center justify-center">
            <Ionicons name="lock-closed-outline" size={30} color={colors.primary} />
          </View>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 22, color: palette.textPrimary, marginTop: 16 }}>
            Giriş Gerekli
          </Text>
          <Text
            style={{ fontFamily: fonts.regular, fontSize: 13, color: palette.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 }}
          >
            Kişisel bilgilerini düzenlemek için önce giriş yapman gerekiyor.
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
              style={{ backgroundColor: isDarkMode ? '#1E3A8A' : '#EFF6FF', borderColor: isDarkMode ? '#1E40AF' : '#BFDBFE' }}
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

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim())  errs.name  = 'Ad soyad boş bırakılamaz.';
    if (!email.trim()) errs.email = 'E-posta boş bırakılamaz.';
    else if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) errs.email = 'Geçerli bir e-posta girin.';
    if (phone.trim() && phone.replace(/\D/g, '').length < 10) errs.phone = 'Geçerli bir telefon numarası girin.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;

    try {
      setSaving(true);

      if (isSupabaseConfigured) {
        await updateProfile({
          full_name: name.trim(),
          username: username.replace(/^@+/, '').trim() || undefined,
          bio: bio.trim() || undefined,
          phone: phone.trim() || undefined,
          gender: gender !== 'Belirtmem' ? gender : undefined,
          birth_date: birth.trim() || undefined,
        });

        if (email.trim().toLowerCase() !== orig.email.trim().toLowerCase()) {
          await updateProfileEmail(email);
        }
      }

      const nextOrig = {
        ...orig,
        name,
        username,
        email,
        bio,
        phone,
        birth,
        gender,
      };

      setOrig(nextOrig);
      showToast('Bilgiler kaydedildi ✓');
      setTimeout(() => router.back(), 1400);
    } catch (error) {
      captureError(error, { scope: 'profile_edit_save' });
      showToast('Profil kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  }

  const Field = ({
    label, value, onChange, keyboardType = 'default', icon, errorKey,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    keyboardType?: 'default' | 'email-address' | 'phone-pad';
    icon: React.ComponentProps<typeof Ionicons>['name'];
    errorKey?: string;
  }) => {
    const err = errorKey ? errors[errorKey] : undefined;
    return (
      <View className="mb-4">
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: err ? colors.danger : palette.textSecondary }} className="mb-1.5 ml-1">
          {label}
        </Text>
        <View
          style={{ borderColor: err ? colors.danger : palette.border, borderWidth: err ? 1.5 : 1, backgroundColor: palette.inputBg }}
          className="flex-row items-center rounded-xl px-3 h-12"
        >
          <Ionicons name={icon} size={16} color={err ? colors.danger : palette.textMuted} />
          <TextInput
            value={value}
            onChangeText={(v) => { onChange(v); if (errorKey && errors[errorKey]) setErrors((e) => ({ ...e, [errorKey]: '' })); }}
            keyboardType={keyboardType}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
            style={{ fontFamily: fonts.regular, fontSize: 14, color: palette.textPrimary }}
            className="flex-1 ml-2.5"
            accessibilityLabel={label}
          />
          {err ? <Ionicons name="alert-circle" size={16} color={colors.danger} /> : null}
        </View>
        {err ? (
          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.danger }} className="ml-1 mt-1">{err}</Text>
        ) : null}
      </View>
    );
  };

  const initials = getInitials(name);
  const scoreColor = completeness >= 80 ? colors.success : completeness >= 50 ? '#D97706' : colors.danger;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.screenBg }} edges={['top']}>
      {/* Header */}
      <View
        style={{ borderBottomColor: palette.borderLight, backgroundColor: palette.surfaceBg }}
        className="flex-row items-center px-4 py-3 border-b"
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center mr-2" accessibilityRole="button" accessibilityLabel="Profil duzenlemeden geri don">
          <Ionicons name="arrow-back" size={22} color={palette.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: palette.textPrimary }} className="flex-1">
          Kişisel Bilgiler
        </Text>
        {isDirty ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary }}
            className="px-4 h-8 rounded-full items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Profil degisikliklerini kaydet"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Kaydet</Text>
            )}
          </Pressable>
        ) : (
          <View
            style={{ backgroundColor: palette.mutedBg }}
            className="px-4 h-8 rounded-full items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: palette.textMuted }}>Kaydet</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <BoxMascot variant="loading" size={100} animated />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: palette.textSecondary, marginTop: 10 }}>
            Profil yükleniyor...
          </Text>
        </View>
      ) : (
      <ScrollView className="flex-1 px-4 pt-5" style={{ backgroundColor: palette.screenBg }} keyboardShouldPersistTaps="handled">
        {/* Avatar + Completeness */}
        <View className="items-center mb-5">
          <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: scoreColor, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={{ width: 80, height: 80 }} />
            ) : (
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, color: colors.primary }}>{initials}</Text>
            )}
          </View>
          <Pressable
            className="mt-2 flex-row items-center"
            onPress={async () => {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) {
                Alert.alert('İzin Gerekli', 'Fotoğraf seçmek için galeri iznine ihtiyaç var.');
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.85,
              });
              if (!result.canceled && result.assets[0]?.uri) {
                try {
                  setSaving(true);
                  const url = await uploadAvatar(result.assets[0].uri);
                  setAvatarUrl(url);
                  showToast('Fotoğraf güncellendi ✓');
                } catch {
                  Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
                } finally {
                  setSaving(false);
                }
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Profil fotografini degistir"
          >
            <Ionicons name="camera-outline" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }} className="ml-1">Fotoğraf Değiştir</Text>
          </Pressable>
        </View>

        {/* Profil Tamamlanma */}
        <View
          style={{ borderColor: palette.borderLight, backgroundColor: palette.surfaceBg }}
          className="rounded-2xl border px-4 py-3 mb-5"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: palette.textPrimary }}>Profil Tamamlanma</Text>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: scoreColor }}>{completeness}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${completeness}%`, backgroundColor: scoreColor, borderRadius: 3 }} />
          </View>
          {completeness < 100 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: palette.textSecondary, marginTop: 6 }}>
              {completeness < 50 ? 'Profilinizi tamamlayarak güven puanınızı artırın.' : 'Neredeyse tamam! Eksik alanları doldurun.'}
            </Text>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.success, marginTop: 6 }}>Profiliniz eksiksiz 🎉</Text>
          )}
        </View>

        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.textSecondary }} className="ml-1 mb-3 uppercase">Temel Bilgiler</Text>

        <Field label="Ad Soyad"          value={name}     onChange={setName}     icon="person-outline"   errorKey="name" />
        <Field label="Kullanıcı Adı"     value={username} onChange={setUsername} icon="at-outline" />
        <Field label="E-posta Adresi"    value={email}    onChange={setEmail}    icon="mail-outline"     keyboardType="email-address" errorKey="email" />
        <Field label="Bio"               value={bio}      onChange={setBio}      icon="document-text-outline" />
        <Field label="Telefon Numarası"  value={phone}    onChange={setPhone}    icon="call-outline"     keyboardType="phone-pad" errorKey="phone" />
        <Field label="Doğum Tarihi"      value={birth}    onChange={setBirth}    icon="calendar-outline" />

        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: palette.textSecondary }} className="ml-1 mb-3 mt-2 uppercase">Cinsiyet</Text>
        <View className="flex-row gap-2 mb-4">
          {(['Kadın', 'Erkek', 'Belirtmem'] as const).map((g) => (
            <Pressable
              key={g}
              onPress={() => setGender(g)}
              style={{ borderColor: gender === g ? colors.primary : palette.border, backgroundColor: gender === g ? (isDarkMode ? '#1E3A8A' : '#EFF6FF') : palette.inputBg }}
              className="flex-1 h-10 rounded-xl items-center justify-center border"
              accessibilityRole="button"
              accessibilityLabel={`${g} cinsiyet secimi`}
            >
              <Text style={{ fontFamily: gender === g ? fonts.bold : fonts.regular, fontSize: 12, color: gender === g ? '#BFDBFE' : palette.textSecondary }}>
                {g}
              </Text>
            </Pressable>
          ))}
        </View>

        {isDirty ? (
          <View
            style={{ backgroundColor: palette.infoBg, borderColor: palette.infoBorder }}
            className="border rounded-2xl px-4 py-3 mb-5 flex-row items-center"
          >
            <Ionicons name="information-circle-outline" size={18} color="#D97706" />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#92400E' }} className="flex-1 ml-2">
              Kaydedilmemiş değişiklikleriniz var.
            </Text>
            <Pressable onPress={handleSave} accessibilityRole="button" accessibilityLabel="Degisiklikleri kaydet">
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#D97706' }}>Kaydet</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="mb-10" />
      </ScrollView>
      )}

      {toast ? (
        <View
          style={{ backgroundColor: colors.success }}
          className="absolute bottom-8 left-4 right-4 rounded-xl px-4 py-3 flex-row items-center justify-center"
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }} className="ml-2">{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
