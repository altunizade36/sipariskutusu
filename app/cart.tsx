import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fonts } from '../src/constants/theme';
import { trackEvent } from '../src/services/monitoring';
import { TELEMETRY_EVENTS } from '../src/constants/telemetryEvents';
import { fetchMyAddresses, type AddressRow } from '../src/services/addressService';
import { fetchMyPaymentMethods, type PaymentMethodRow } from '../src/services/paymentMethodService';
import { buildSellerMessagesRoute } from '../src/utils/messageRouting';

type Step = 'details' | 'confirm';

function formatCurrency(value: number) {
  return `₺${value.toFixed(2)}`;
}

function buildContactDraftId() {
  return `ILN-${Date.now().toString().slice(-6)}`;
}

export default function CartScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    sellerId?: string;
    productId?: string;
    title?: string;
    price?: string;
    whatsapp?: string;
  }>();

  const sellerId = params.sellerId?.trim() || '';
  const productId = params.productId?.trim() || '';
  const whatsappContact = params.whatsapp?.trim() || '';
  const productTitle = params.title ? decodeURIComponent(params.title) : 'Secilen Ilan';
  const productPrice = Number(params.price ?? '0');
  const normalizedPrice = Number.isFinite(productPrice) && productPrice > 0 ? productPrice : 0;

  const [step, setStep] = useState<Step>('details');
  const [quantity, setQuantity] = useState(1);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [note, setNote] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<AddressRow[]>([]);
  const [savedContactNotes, setSavedContactNotes] = useState<PaymentMethodRow[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [selectedContactNoteId, setSelectedContactNoteId] = useState('');

  const total = useMemo(() => normalizedPrice * quantity, [normalizedPrice, quantity]);

  useEffect(() => {
    trackEvent(TELEMETRY_EVENTS.CART_INITIATED, {
      product_id: productId,
      product_title: productTitle,
      price: normalizedPrice || null,
      seller_id: sellerId || null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;

    Promise.allSettled([fetchMyAddresses(), fetchMyPaymentMethods()]).then(([addressesResult, contactNotesResult]) => {
      if (!active) {
        return;
      }

      if (addressesResult.status === 'fulfilled') {
        const rows = addressesResult.value;
        setSavedAddresses(rows);
        const preferred = rows.find((item) => item.is_default) ?? rows[0];
        if (preferred) {
          setSelectedAddressId(preferred.id);
          setCity((prev) => prev || preferred.city || '');
          setDistrict((prev) => prev || preferred.district || '');
        }
      }

      if (contactNotesResult.status === 'fulfilled') {
        const rows = contactNotesResult.value;
        setSavedContactNotes(rows);
        const preferred = rows.find((item) => item.is_default) ?? rows[0];
        if (preferred) {
          setSelectedContactNoteId(preferred.id);
        }
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const selectedAddress = useMemo(() => {
    return savedAddresses.find((item) => item.id === selectedAddressId) ?? null;
  }, [savedAddresses, selectedAddressId]);

  const selectedContactNote = useMemo(() => {
    return savedContactNotes.find((item) => item.id === selectedContactNoteId) ?? null;
  }, [savedContactNotes, selectedContactNoteId]);

  function startConversation() {
    if (!sellerId) {
      Alert.alert('Satici bilgisi eksik', 'Bu ilan icin satici bilgisi bulunamadi. Ilandan tekrar dene.');
      return;
    }

    const draftId = buildContactDraftId();
    trackEvent(TELEMETRY_EVENTS.ORDER_DRAFT_SENT, {
      product_id: productId,
      seller_id: sellerId || null,
      quantity,
      subtotal: total,
      total,
      payment_method: 'direct_negotiation',
      draft_order_id: draftId,
    });

    const lines = [
      `Ilan gorusmesi #${draftId}`,
      `Ilan: ${productTitle}`,
      `Adet: ${quantity}`,
      normalizedPrice > 0 ? `Ilandaki Fiyat: ${formatCurrency(normalizedPrice)}` : 'Ilandaki Fiyat: Mesajda netlesecek',
      selectedAddress ? `Bulusma/Teslim referansi: ${selectedAddress.title} - ${selectedAddress.city}` : '',
      city ? `Sehir: ${city}` : '',
      district ? `Ilce: ${district}` : '',
      selectedContactNote ? `Iletisim Notum: ${selectedContactNote.brand || 'Not yok'}` : '',
      note ? `Ek Not: ${note}` : '',
      'Platform odeme ve kargo takibi yapmaz. Detaylari burada netlestirebilir miyiz?',
    ].filter(Boolean);

    router.push(buildSellerMessagesRoute({
      sellerId,
      productId,
      productTitle,
      whatsapp: whatsappContact || undefined,
      initialMessage: lines.join('\n'),
    }));
  }

  function openWhatsApp() {
    if (!whatsappContact) {
      Alert.alert('Bilgi', 'Bu ilan icin WhatsApp baglantisi yok. Mesaj ekranindan devam edebilirsin.');
      return;
    }

    const normalized = whatsappContact.replace(/\D/g, '');
    const text = encodeURIComponent(`${productTitle} ilanı icin gorusebilir miyiz?`);
    Linking.openURL(`https://wa.me/${normalized}?text=${text}`).catch(() => {
      Alert.alert('Hata', 'WhatsApp baglantisi acilamadi.');
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#fff' }}>
        <Pressable onPress={() => router.back()} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={{ fontFamily: fonts.headingBold, fontSize: 16, color: colors.textPrimary }}>Ilan Iletisim Taslagi</Text>
      </View>

      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
        {['Detay', 'Onay'].map((label, index) => {
          const current = step === 'details' ? 0 : 1;
          const active = index <= current;
          return (
            <View key={label} style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: active ? colors.primary : '#E2E8F0' }} />
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 }}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.textPrimary }}>{productTitle}</Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>
            Bu akis sadece alici ve saticiyi gorusturur. Odeme ve teslimat taraflar arasinda yapilir.
          </Text>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.primary, marginTop: 8 }}>
            {normalizedPrice > 0 ? formatCurrency(normalizedPrice) : 'Fiyat Mesajda Netlesecek'}
          </Text>
        </View>

        {step === 'details' ? (
          <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>Adet</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={18} color={colors.textPrimary} />
              </Pressable>
              <Text style={{ fontFamily: fonts.headingBold, fontSize: 20, color: colors.textPrimary, minWidth: 28, textAlign: 'center' }}>{quantity}</Text>
              <Pressable onPress={() => setQuantity((q) => Math.min(20, q + 1))} style={{ width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            {savedAddresses.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>Konum Referansi (Opsiyonel)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {savedAddresses.map((address) => {
                    const active = selectedAddressId === address.id;
                    return (
                      <Pressable
                        key={address.id}
                        onPress={() => {
                          setSelectedAddressId(address.id);
                          setCity(address.city || '');
                          setDistrict(address.district || '');
                        }}
                        style={{
                          borderWidth: 1,
                          borderColor: active ? '#93C5FD' : '#E2E8F0',
                          backgroundColor: active ? '#EFF6FF' : '#fff',
                          borderRadius: 12,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          minWidth: 128,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.textPrimary }} numberOfLines={1}>{address.title}</Text>
                        <Text style={{ fontFamily: fonts.regular, fontSize: 10, color: colors.textSecondary }} numberOfLines={1}>{address.city}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ marginTop: 12 }}>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Sehir (opsiyonel)"
                placeholderTextColor={colors.textMuted}
                style={{ height: 44, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, marginBottom: 8, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}
              />
              <TextInput
                value={district}
                onChangeText={setDistrict}
                placeholder="Ilce (opsiyonel)"
                placeholderTextColor={colors.textMuted}
                style={{ height: 44, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, fontFamily: fonts.regular, fontSize: 14, color: colors.textPrimary }}
              />
            </View>

            {savedContactNotes.length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>Kayitli Iletisim Notu (Opsiyonel)</Text>
                <View style={{ gap: 8 }}>
                  {savedContactNotes.slice(0, 3).map((item) => {
                    const active = selectedContactNoteId === item.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setSelectedContactNoteId(item.id)}
                        style={{
                          borderWidth: 1,
                          borderColor: active ? '#93C5FD' : '#E2E8F0',
                          backgroundColor: active ? '#EFF6FF' : '#fff',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                        }}
                      >
                        <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.textPrimary }}>{item.brand || 'Not'}</Text>
                        {item.holder_name ? (
                          <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                            {item.holder_name}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginTop: 12, marginBottom: 8 }}>Ek Not</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Bulusma saati, iletisim tercihi, urun durumu sorulari..."
              placeholderTextColor={colors.textMuted}
              multiline
              style={{ minHeight: 84, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingTop: 10, fontFamily: fonts.regular, fontSize: 13, color: colors.textPrimary, textAlignVertical: 'top' }}
            />
          </View>
        ) : (
          <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 }}>
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: colors.textPrimary, marginBottom: 8 }}>Onay Ozeti</Text>
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>Adet: {quantity}</Text>
              {normalizedPrice > 0 ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>Ilandaki Fiyat: {formatCurrency(normalizedPrice)}</Text>
              ) : null}
              {selectedAddress ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>Secilen Konum: {selectedAddress.title}</Text>
              ) : null}
              {city ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>Sehir: {city}</Text> : null}
              {district ? <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>Ilce: {district}</Text> : null}
              {selectedContactNote ? (
                <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary }}>
                  Iletisim Notu: {selectedContactNote.brand || 'Kayitli not'}
                </Text>
              ) : null}
              <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                Platform odeme ve kargo takibi sunmaz. Bu adim sadece iletisim mesaji baslatir.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary }}>Referans Fiyat</Text>
          <Text style={{ fontFamily: fonts.headingBold, fontSize: 18, color: colors.primary }}>{normalizedPrice > 0 ? formatCurrency(total) : 'Mesajda netlesecek'}</Text>
        </View>

        {step !== 'confirm' ? (
          <Pressable
            onPress={() => {
              trackEvent(TELEMETRY_EVENTS.CART_STEP_ADVANCED, { from_step: 'details', to_step: 'confirm', product_id: productId || null });
              setStep('confirm');
            }}
            style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Onaya Gec</Text>
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              onPress={startConversation}
              style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F766E' }}
            >
              <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>Mesajlasmayi Baslat</Text>
            </Pressable>
            {whatsappContact ? (
              <Pressable
                onPress={openWhatsApp}
                style={{ height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', borderWidth: 1, borderColor: '#86EFAC' }}
              >
                <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#166534' }}>WhatsApp ile baglan</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
