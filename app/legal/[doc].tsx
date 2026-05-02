import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../../src/constants/theme';

const DOC_TABS: { key: LegalDocKey; label: string }[] = [
  { key: 'terms-of-use',       label: 'Şartlar' },
  { key: 'privacy-kvkk',       label: 'Gizlilik & KVKK' },
  { key: 'platform-liability', label: 'Sorumluluk' },
  { key: 'prohibited-products', label: 'Yasaklı Ürünler' },
];

type LegalDocKey =
  | 'terms-of-use'
  | 'privacy-kvkk'
  | 'platform-liability'
  | 'prohibited-products';

type LegalSection = {
  heading: string;
  content: string;
};

type LegalDoc = {
  title: string;
  summary: string;
  sections: LegalSection[];
  lastUpdated: string;
};

const SUPPORT_EMAIL = 'iletisim@sipariskutusu.com';

const LEGAL_DOCS: Record<LegalDocKey, LegalDoc> = {
  'terms-of-use': {
    title: 'Kullanım Şartları',
    summary:
      'Bu platform, alıcı ve satıcıyı buluşturan bir ilan ve mesajlaşma altyapısıdır. Platform, satış işleminin tarafı değildir.',
    sections: [
      {
        heading: 'Platformın Rolü',
        content:
          'Platform; ilan yayınlama, ürün keşfi ve mesajlaşma altyapısı sağlar. Alıcı ile satıcı arasındaki anlaşma, tarafların kendi iradeleri ile kurulur.',
      },
      {
        heading: 'Kullanıcı Yükümlülükleri',
        content:
          'Kullanıcılar doğru bilgi vermek, yürürlükteki mevzuata uymak ve diğer kullanıcıların haklarını ihlal etmemekle yükümlüdür.',
      },
      {
        heading: 'İçerik Sorumluluğu',
        content:
          'İlan içeriklerinin doğruluğu, ürün bilgileri, fiyat ve koşulların güncelliği ilan sahibi kullanıcıya aittir.',
      },
      {
        heading: 'Hesap Güvenliği',
        content:
          'Kullanıcı hesabının güvenliği kullanıcı sorumluluğundadır. Şüpheli kullanım tespitinde platform güvenlik amacıyla geçici kısıtlama uygulayabilir.',
      },
    ],
    lastUpdated: '24.04.2026',
  },
  'privacy-kvkk': {
    title: 'KVKK Metni',
    summary:
      '6698 sayılı KVKK kapsamında, kişisel veriler kullanıcı deneyimi, güvenlik ve iletişim amaçlarıyla işlenir.',
    sections: [
      {
        heading: 'İşlenen Veriler',
        content:
          'Kimlik ve iletişim bilgileri, hesap verileri, cihaz/IP bilgileri ve mesajlaşma operasyonu için gerekli teknik kayıtlar işlenebilir.',
      },
      {
        heading: 'İşleme Amaçları',
        content:
          'Hesap yönetimi, güvenlik, kötüye kullanım önleme, yasal yükümlülüklerin yerine getirilmesi ve hizmet kalitesinin iyileştirilmesi amaçlarıyla veri işlenir.',
      },
      {
        heading: 'Veri Paylaşımı',
        content:
          'Veriler, yasal zorunluluklar dışında üçüncü taraflara satılmaz. Teknik altyapı hizmetleri kapsamında yalnızca gerekli ölçüde paylaşım yapılır.',
      },
      {
        heading: 'Kullanıcı Hakları',
        content:
          'KVKK kapsamında erişim, düzeltme, silme ve itiraz haklarına sahipsiniz. Taleplerinizi platform iletişim kanalları üzerinden iletebilirsiniz.',
      },
      {
        heading: 'İletişim',
        content: `KVKK ve gizlilik talepleriniz için: ${SUPPORT_EMAIL}`,
      },
    ],
    lastUpdated: '24.04.2026',
  },
  'platform-liability': {
    title: 'Sorumluluk Reddi',
    summary:
      'Platform yalnızca alıcı ve satıcıyı buluşturur. Ödeme, kargo, teslimat ve satış sonrası süreçler taraflar arasında yürütülür.',
    sections: [
      {
        heading: 'Ödeme ve Teslimat',
        content:
          'Ödeme ve teslimat platform dışında kararlaştırılır. Platform tahsilat, para transferi, emanet ödeme veya kargo operasyonu yürütmez.',
      },
      {
        heading: 'Ürün Uygunluğu',
        content:
          'Ürün açıklamasına uygunluk, orijinallik, durum bilgisi ve garanti koşullarından satıcı sorumludur.',
      },
      {
        heading: 'Uyuşmazlıklar',
        content:
          'Taraflar arasında doğabilecek uyuşmazlıklarda hukuki ve mali sorumluluk taraflara aittir. Platform, yalnızca teknik kayıt desteği sağlayabilir.',
      },
      {
        heading: 'Sınırlandırma',
        content:
          'Platform dolaylı zarar, gelir kaybı veya taraflar arası anlaşmazlık nedeniyle doğabilecek sonuçlardan sorumlu tutulamaz.',
      },
    ],
    lastUpdated: '24.04.2026',
  },
  'prohibited-products': {
    title: 'Yasaklı Ürün Listesi',
    summary:
      'Yasa dışı, tehlikeli veya mevzuata aykırı ürünlerin ilanı ve satışı yasaktır.',
    sections: [
      {
        heading: 'Yasal Olarak Yasaklı Ürünler',
        content:
          'Uyuşturucu maddeler, ruhsatsız silahlar, patlayıcılar, kaçak veya sahte resmi belgeler ve mevzuata aykırı her türlü ürün yasaktır.',
      },
      {
        heading: 'Sağlık ve Güvenlik Riski Taşıyan Ürünler',
        content:
          'İnsan sağlığını tehdit eden, sahte ilaç, izinsiz tıbbi ürün ve tehlikeli kimyasal maddelerin ilanına izin verilmez.',
      },
      {
        heading: 'Fikri Mülkiyet İhlali',
        content:
          'Sahte marka ürünler, telif hakkını ihlal eden içerikler ve taklit ürünlerin paylaşımı yasaktır.',
      },
      {
        heading: 'Yaptırım',
        content:
          'Yasaklı ürün tespitinde ilan kaldırılır, hesap askıya alınabilir veya kapatılabilir. Gerekli durumlarda yasal mercilere bildirim yapılır.',
      },
    ],
    lastUpdated: '24.04.2026',
  },
};

export default function LegalDocScreen() {
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key = (doc as LegalDocKey) ?? 'terms-of-use';
  const item = LEGAL_DOCS[key] ?? LEGAL_DOCS['terms-of-use'];

  return (
    <SafeAreaView className="flex-1 bg-[#F7F7F7]" edges={['top']}>
      {/* Header */}
      <View className="bg-white border-b border-[#33333315]">
        <View className="px-3 py-2 flex-row items-center">
          <Pressable onPress={() => router.back()} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }} className="flex-1 ml-2">
            Yasal Belgeler
          </Text>
        </View>

        {/* Doc switcher tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 0, gap: 6, flexDirection: 'row' }}
        >
          {DOC_TABS.map((tab) => {
            const active = tab.key === key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => router.replace({ pathname: '/legal/[doc]', params: { doc: tab.key } })}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderBottomWidth: 2,
                  borderBottomColor: active ? '#3B82F6' : 'transparent',
                  marginBottom: -1,
                }}
              >
                <Text
                  style={{
                    fontFamily: active ? fonts.bold : fonts.regular,
                    fontSize: 13,
                    color: active ? '#3B82F6' : colors.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 12 }}>
        <View className="bg-white rounded-xl border border-[#33333315] p-4">
          {/* Summary */}
          <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, lineHeight: 22 }}>
            {item.summary}
          </Text>

          <View className="h-px bg-[#33333315] my-3" />

          {/* Sections */}
          {item.sections.map((section, index) => (
            <View key={section.heading} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                  <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: '#3B82F6' }}>{index + 1}</Text>
                </View>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, flex: 1 }}>
                  {section.heading}
                </Text>
              </View>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, lineHeight: 22, paddingLeft: 30 }}>
                {section.content}
              </Text>
            </View>
          ))}

          {/* Footer */}
          <View style={{ borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', padding: 12, marginTop: 4 }}>
            <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary }}>
              Son güncelleme: {item.lastUpdated}
            </Text>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              İletişim: iletisim@sipariskutusu.com
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
