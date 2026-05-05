import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { completeInstagramOAuth } from '../src/services/instagramService';
import { getMetaIntegrationConfig } from '../src/services/metaConfig';

export default function InstagramAuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; error?: string; error_description?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Instagram bağlantısı tamamlanıyor...');

  useEffect(() => {
    let active = true;

    async function finishAuth() {
      const error = params.error_description || params.error;
      const code = Array.isArray(params.code) ? params.code[0] : params.code;

      if (error) {
        setStatus('error');
        setMessage(String(error));
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('Instagram yetkilendirme kodu alınamadı.');
        return;
      }

      try {
        const config = getMetaIntegrationConfig();
        await completeInstagramOAuth(code, config.redirectUri, config.authProvider);
        if (!active) return;
        setStatus('success');
        setMessage('Instagram hesabı bağlandı. İçerikler hazırlanıyor...');
        setTimeout(() => router.replace('/instagram-content' as never), 900);
      } catch (err) {
        if (!active) return;
        setStatus('error');
        setMessage(err instanceof Error ? err.message : 'Instagram bağlantısı tamamlanamadı.');
      }
    }

    void finishAuth();
    return () => {
      active = false;
    };
  }, [params.code, params.error, params.error_description, router]);

  const isLoading = status === 'loading';
  const icon = status === 'success' ? 'checkmark-circle' : status === 'error' ? 'alert-circle' : 'logo-instagram';
  const iconColor = status === 'success' ? '#16A34A' : status === 'error' ? colors.danger : '#E1306C';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <View style={{ width: 86, height: 86, borderRadius: 43, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
        {isLoading ? <ActivityIndicator color="#E1306C" size="large" /> : <Ionicons name={icon as never} size={42} color={iconColor} />}
      </View>
      <Text style={{ fontFamily: fonts.headingBold, fontSize: 21, color: '#0F172A', textAlign: 'center' }}>
        {status === 'success' ? 'Bağlantı tamamlandı' : status === 'error' ? 'Bağlantı tamamlanamadı' : 'Instagram Bağlanıyor'}
      </Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 10, lineHeight: 22 }}>
        {message}
      </Text>
      {status === 'error' ? (
        <Pressable
          onPress={() => router.replace('/instagram-connect' as never)}
          style={{ marginTop: 22, backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12 }}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Tekrar Dene</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}
