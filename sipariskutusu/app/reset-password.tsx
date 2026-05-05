import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { useAuth } from '../src/context/AuthContext';

function mapResetError(error: unknown) {
  const raw = error instanceof Error ? error.message.toLowerCase() : '';

  if (raw.includes('auth session missing')) {
    return 'Oturum bulunamadı. Sıfırlama bağlantısına e-postadan yeniden tıklayın.';
  }

  if (raw.includes('token') && raw.includes('expired')) {
    return 'Sıfırlama bağlantısının süresi dolmuş. Yeni bağlantı isteyin.';
  }

  if (raw.includes('same password')) {
    return 'Yeni şifre eski şifre ile aynı olamaz.';
  }

  return error instanceof Error ? error.message : 'Şifre güncellenemedi.';
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const canSubmit = hasMinLength && (hasUppercase || hasNumber) && confirmPassword === password;

  async function handleUpdatePassword() {
    if (!canSubmit) {
      Alert.alert('Geçersiz Şifre', 'Şifre en az 8 karakter olmalı ve tekrar alanı eşleşmeli.');
      return;
    }

    try {
      setLoading(true);
      await updatePassword(password);
      Alert.alert('Başarılı', 'Şifreniz güncellendi. Şimdi giriş yapabilirsiniz.', [
        {
          text: 'Tamam',
          onPress: () => router.replace('/auth'),
        },
      ]);
    } catch (error) {
      Alert.alert('Hata', mapResetError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }} edges={['top']}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.textPrimary, marginLeft: 8 }}>
          Şifre Sıfırla
        </Text>
      </View>

      <View style={{ margin: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: colors.borderLight, padding: 16 }}>
        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Yeni Şifre</Text>
        <View style={{ borderWidth: 1, borderColor: colors.borderDefault, borderRadius: 12, height: 46, paddingHorizontal: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center' }}>
          <TextInput
            value={password}
            onChangeText={setPassword}
            showSoftInputOnFocus
            placeholder="En az 8 karakter"
            secureTextEntry={!showPassword}
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontFamily: fonts.regular, color: colors.textPrimary, fontSize: 14 }}
          />
          <Pressable onPress={() => setShowPassword((prev) => !prev)} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        {password.length > 0 ? (
          <View style={{ marginBottom: 12, gap: 5 }}>
            {[
              { ok: hasMinLength, label: 'En az 8 karakter' },
              { ok: hasUppercase || hasNumber, label: 'Büyük harf veya rakam içermeli' },
            ].map(({ ok, label }) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? '#059669' : colors.textMuted} />
                <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: ok ? '#047857' : colors.textMuted }}>{label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>Yeni Şifre Tekrar</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          showSoftInputOnFocus
          placeholder="Şifreyi tekrar gir"
          secureTextEntry={!showPassword}
          placeholderTextColor={colors.textMuted}
          style={{ borderWidth: 1, borderColor: confirmPassword.length > 0 && confirmPassword !== password ? '#EF4444' : colors.borderDefault, borderRadius: 12, height: 46, paddingHorizontal: 12, marginBottom: 14, fontFamily: fonts.regular, color: colors.textPrimary, fontSize: 14 }}
        />
        {confirmPassword.length > 0 && confirmPassword !== password ? (
          <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: '#EF4444', marginTop: -10, marginBottom: 10 }}>
            Şifreler eşleşmiyor
          </Text>
        ) : null}

        <Pressable
          onPress={handleUpdatePassword}
          disabled={!canSubmit || loading}
          style={{ height: 48, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: !canSubmit || loading ? 0.6 : 1 }}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Şifreyi Güncelle</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
