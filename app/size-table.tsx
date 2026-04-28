import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';

type Gender = 'kadin' | 'erkek' | 'cocuk';

const KADIN_BEDENLERI = [
  { beden: 'XS', eu: '34', tr: '34', gogus: '80-84', bel: '62-66', kalca: '88-92' },
  { beden: 'S', eu: '36', tr: '36', gogus: '84-88', bel: '66-70', kalca: '92-96' },
  { beden: 'M', eu: '38', tr: '38', gogus: '88-92', bel: '70-74', kalca: '96-100' },
  { beden: 'L', eu: '40', tr: '40', gogus: '92-96', bel: '74-78', kalca: '100-104' },
  { beden: 'XL', eu: '42', tr: '42', gogus: '96-100', bel: '78-82', kalca: '104-108' },
  { beden: '2XL', eu: '44', tr: '44', gogus: '100-104', bel: '82-86', kalca: '108-112' },
  { beden: '3XL', eu: '46', tr: '46', gogus: '104-108', bel: '86-90', kalca: '112-116' },
];

const ERKEK_BEDENLERI = [
  { beden: 'XS', eu: '44', tr: '44', gogus: '84-88', bel: '70-74', omuz: '43' },
  { beden: 'S', eu: '46', tr: '46', gogus: '88-92', bel: '74-78', omuz: '44' },
  { beden: 'M', eu: '48', tr: '48', gogus: '92-96', bel: '78-82', omuz: '46' },
  { beden: 'L', eu: '50', tr: '50', gogus: '96-100', bel: '82-86', omuz: '47' },
  { beden: 'XL', eu: '52', tr: '52', gogus: '100-104', bel: '86-90', omuz: '49' },
  { beden: '2XL', eu: '54', tr: '54', gogus: '104-108', bel: '90-94', omuz: '50' },
  { beden: '3XL', eu: '56', tr: '56', gogus: '108-112', bel: '94-98', omuz: '52' },
];

const COCUK_BEDENLERI = [
  { beden: '92', yas: '1-2', boy: '86-92', gogus: '51-53' },
  { beden: '98', yas: '2-3', boy: '92-98', gogus: '53-55' },
  { beden: '104', yas: '3-4', boy: '98-104', gogus: '55-57' },
  { beden: '110', yas: '4-5', boy: '104-110', gogus: '57-60' },
  { beden: '116', yas: '5-6', boy: '110-116', gogus: '60-63' },
  { beden: '122', yas: '6-7', boy: '116-122', gogus: '63-66' },
  { beden: '128', yas: '7-8', boy: '122-128', gogus: '66-69' },
  { beden: '134', yas: '8-9', boy: '128-134', gogus: '69-72' },
  { beden: '140', yas: '9-10', boy: '134-140', gogus: '72-75' },
  { beden: '146', yas: '10-11', boy: '140-146', gogus: '75-78' },
  { beden: '152', yas: '11-12', boy: '146-152', gogus: '78-81' },
];

const HEADER_BG = '#F7F7F9';
const BORDER = '#EBEBEB';

function TableHeader({ cols }: { cols: string[] }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: HEADER_BG, borderBottomWidth: 1, borderBottomColor: BORDER }}>
      {cols.map((col) => (
        <View key={col} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary }}>{col}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRow({ cells, index }: { cells: string[]; index: number }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#FAFAFA',
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
      }}
    >
      {cells.map((cell, i) => (
        <View key={i} style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center' }}>
          <Text style={{ fontFamily: i === 0 ? fonts.bold : fonts.regular, fontSize: 13, color: colors.textPrimary }}>
            {cell}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function SizeTableScreen() {
  const router = useRouter();
  const [gender, setGender] = useState<Gender>('kadin');

  const tabs: { key: Gender; label: string }[] = [
    { key: 'kadin', label: 'Kadın' },
    { key: 'erkek', label: 'Erkek' },
    { key: 'cocuk', label: 'Çocuk' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top']}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: BORDER,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary }}>Beden Tablosu</Text>
      </View>

      {/* Gender tabs */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4, gap: 8 }}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setGender(tab.key)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: gender === tab.key ? colors.primary : '#F0F0F0',
            }}
          >
            <Text
              style={{
                fontFamily: fonts.bold,
                fontSize: 13,
                color: gender === tab.key ? '#FFFFFF' : colors.textSecondary,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        <Text
          style={{
            fontFamily: fonts.medium,
            fontSize: 12,
            color: colors.textMuted,
            paddingHorizontal: 16,
            paddingVertical: 10,
            lineHeight: 18,
          }}
        >
          Ölçüler santimetre (cm) cinsindendir. Farklı modeller arasında ufak farklar olabilir.
        </Text>

        {/* Table */}
        <View style={{ marginHorizontal: 16, borderWidth: 1, borderColor: BORDER, borderRadius: 10, overflow: 'hidden' }}>
          {gender === 'kadin' && (
            <>
              <TableHeader cols={['Beden', 'EU', 'TR', 'Göğüs', 'Bel', 'Kalça']} />
              {KADIN_BEDENLERI.map((r, i) => (
                <TableRow key={r.beden} cells={[r.beden, r.eu, r.tr, r.gogus, r.bel, r.kalca]} index={i} />
              ))}
            </>
          )}
          {gender === 'erkek' && (
            <>
              <TableHeader cols={['Beden', 'EU', 'TR', 'Göğüs', 'Bel', 'Omuz']} />
              {ERKEK_BEDENLERI.map((r, i) => (
                <TableRow key={r.beden} cells={[r.beden, r.eu, r.tr, r.gogus, r.bel, r.omuz]} index={i} />
              ))}
            </>
          )}
          {gender === 'cocuk' && (
            <>
              <TableHeader cols={['Beden', 'Yaş', 'Boy', 'Göğüs']} />
              {COCUK_BEDENLERI.map((r, i) => (
                <TableRow key={r.beden} cells={[r.beden, r.yas, r.boy, r.gogus]} index={i} />
              ))}
            </>
          )}
        </View>

        {/* Tip */}
        <View
          style={{
            margin: 16,
            padding: 14,
            backgroundColor: '#EFF6FF',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.primary, flex: 1, lineHeight: 18 }}>
            En doğru bedeni bulmak için göğüs, bel ve kalça ölçülerinizi alın ve tablodaki aralıklarla karşılaştırın.
            İki beden arasındaysan bir büyüğünü tercih et.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
