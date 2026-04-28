import { ActivityIndicator, Alert, View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { colors, fonts } from '../src/constants/theme';
import { fetchMyProfile, updateProfile } from '../src/services/profileService';
import { captureError } from '../src/services/monitoring';
import { isSupabaseConfigured } from '../src/services/supabase';
import { useAuth } from '../src/context/AuthContext';

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const authName = (user?.user_metadata?.full_name as string | undefined) ?? '';
  const authEmail = user?.email ?? '';

  const [orig, setOrig] = useState({
    name: authName || '',
    username: '',
    email: authEmail,
    phone: '',
    birth: '',
    gender: 'Belirtmem' as const,
  });

  const [name, setName] = useState(orig.name);
  const [username, setUsername] = useState(orig.username);
  const [email, setEmail] = useState(orig.email);
  const [phone, setPhone] = useState(orig.phone);
  const [birth, setBirth] = useState(orig.birth);
  const [gender, setGender] = useState<'Kadın' | 'Erkek' | 'Belirtmem'>(orig.gender as 'Kadın');
  const [toast, setToast] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isDirty = name !== orig.name || username !== orig.username || email !== orig.email || phone !== orig.phone || birth !== orig.birth;

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

        const nextOrig = {
          name: profile.full_name?.trim() || 'Kullanıcı',
          username: profile.username ? `@${profile.username.replace(/^@+/, '')}` : '',
          email: '',
          phone: profile.phone?.trim() || '',
          birth: '',
          gender: 'Belirtmem' as const,
        };

        setOrig(nextOrig);
        setName(nextOrig.name);
        setUsername(nextOrig.username);
        setEmail(nextOrig.email);
        setPhone(nextOrig.phone);
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
  }, []);

  const completeness = useMemo(() => {
    const fields = [name, username, email, phone, birth, gender];
    const filled = fields.filter((f) => f.trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [name, username, email, phone, birth, gender]);

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
          phone: phone.trim() || undefined,
        });
      }

      const nextOrig = {
        ...orig,
        name,
        username,
        email,
        phone,
        birth,
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
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: err ? colors.danger : colors.textSecondary }} className="mb-1.5 ml-1">
          {label}
        </Text>
        <View
          style={{ borderColor: err ? colors.danger : colors.borderDefault, borderWidth: err ? 1.5 : 1 }}
          className="flex-row items-center bg-white rounded-xl px-3 h-12"
        >
          <Ionicons name={icon} size={16} color={err ? colors.danger : colors.textMuted} />
          <TextInput
            value={value}
            onChangeText={(v) => { onChange(v); if (errorKey && errors[errorKey]) setErrors((e) => ({ ...e, [errorKey]: '' })); }}
            keyboardType={keyboardType}
            showSoftInputOnFocus
            autoCorrect
            autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
            style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}
            className="flex-1 ml-2.5"
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
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      {/* Header */}
      <View
        style={{ borderBottomColor: colors.borderLight }}
        className="flex-row items-center px-4 py-3 bg-white border-b"
      >
        <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center mr-2">
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary }} className="flex-1">
          Kişisel Bilgiler
        </Text>
        {isDirty ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={{ backgroundColor: colors.primary }}
            className="px-4 h-8 rounded-full items-center justify-center"
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: '#fff' }}>Kaydet</Text>
            )}
          </Pressable>
        ) : (
          <View
            style={{ backgroundColor: '#F1F5F9' }}
            className="px-4 h-8 rounded-full items-center justify-center"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textMuted }}>Kaydet</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 10 }}>
            Profil yükleniyor...
          </Text>
        </View>
      ) : (
      <ScrollView className="flex-1 px-4 pt-5" keyboardShouldPersistTaps="handled">
        {/* Avatar + Completeness */}
        <View className="items-center mb-5">
          <View style={{ backgroundColor: '#DBEAFE', width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: scoreColor }}>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 28, color: colors.primary }}>{initials}</Text>
          </View>
          <Pressable
            className="mt-2 flex-row items-center"
            onPress={() => Alert.alert('Bilgi', 'Profil fotoğrafı yükleme bir sonraki sürümde medya servisi ile açılacak.')}
          >
            <Ionicons name="camera-outline" size={14} color={colors.primary} />
            <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.primary }} className="ml-1">Fotoğraf Değiştir</Text>
          </Pressable>
        </View>

        {/* Profil Tamamlanma */}
        <View
          style={{ borderColor: colors.borderLight }}
          className="bg-white rounded-2xl border px-4 py-3 mb-5"
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary }}>Profil Tamamlanma</Text>
            <Text style={{ fontFamily: fonts.headingBold, fontSize: 14, color: scoreColor }}>{completeness}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${completeness}%`, backgroundColor: scoreColor, borderRadius: 3 }} />
          </View>
          {completeness < 100 ? (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 6 }}>
              {completeness < 50 ? 'Profilinizi tamamlayarak güven puanınızı artırın.' : 'Neredeyse tamam! Eksik alanları doldurun.'}
            </Text>
          ) : (
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.success, marginTop: 6 }}>Profiliniz eksiksiz 🎉</Text>
          )}
        </View>

        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary }} className="ml-1 mb-3 uppercase">Temel Bilgiler</Text>

        <Field label="Ad Soyad"          value={name}     onChange={setName}     icon="person-outline"   errorKey="name" />
        <Field label="Kullanıcı Adı"     value={username} onChange={setUsername} icon="at-outline" />
        <Field label="E-posta Adresi"    value={email}    onChange={setEmail}    icon="mail-outline"     keyboardType="email-address" errorKey="email" />
        <Field label="Telefon Numarası"  value={phone}    onChange={setPhone}    icon="call-outline"     keyboardType="phone-pad" errorKey="phone" />
        <Field label="Doğum Tarihi"      value={birth}    onChange={setBirth}    icon="calendar-outline" />

        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary }} className="ml-1 mb-3 mt-2 uppercase">Cinsiyet</Text>
        <View className="flex-row gap-2 mb-4">
          {(['Kadın', 'Erkek', 'Belirtmem'] as const).map((g) => (
            <Pressable
              key={g}
              onPress={() => setGender(g)}
              style={{ borderColor: gender === g ? colors.primary : colors.borderDefault, backgroundColor: gender === g ? '#EFF6FF' : '#fff' }}
              className="flex-1 h-10 rounded-xl items-center justify-center border"
            >
              <Text style={{ fontFamily: gender === g ? fonts.bold : fonts.regular, fontSize: 12, color: gender === g ? colors.primary : colors.textSecondary }}>
                {g}
              </Text>
            </Pressable>
          ))}
        </View>

        {isDirty ? (
          <View
            style={{ backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }}
            className="border rounded-2xl px-4 py-3 mb-5 flex-row items-center"
          >
            <Ionicons name="information-circle-outline" size={18} color="#D97706" />
            <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: '#92400E' }} className="flex-1 ml-2">
              Kaydedilmemiş değişiklikleriniz var.
            </Text>
            <Pressable onPress={handleSave}>
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
