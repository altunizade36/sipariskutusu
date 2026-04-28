import { View, Text, Pressable, Image, ScrollView, Dimensions, Alert, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { colors, fonts } from '../constants/theme';
import type { Product } from '../data/mockData';
import { useFavorites } from '../hooks/useFavorites';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = {
  product: Product;
  visible: boolean;
  onClose: () => void;
  sellerName?: string;
  sellerStoreId?: string;
};

type ActionId = 'view' | 'contact' | 'share' | 'whatsapp';

const ACTION_ITEMS: Array<{ id: ActionId; label: string; icon: string; color: string }> = [
  { id: 'view', label: 'İlanı Gör', icon: 'eye-outline', color: colors.primary },
  { id: 'contact', label: 'Satıcıya Sor', icon: 'chatbubble-outline', color: colors.primary },
  { id: 'share', label: 'Paylaş', icon: 'share-social-outline', color: colors.primary },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp', color: '#25D366' },
];

export function ProductActionOverlay({
  product,
  visible,
  onClose,
  sellerName,
  sellerStoreId,
}: Props) {
  const router = useRouter();
  const { checkFavorited, toggle } = useFavorites();
  const [selectedAction, setSelectedAction] = useState<ActionId | null>(null);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    let alive = true;

    if (!visible) {
      return () => {
        alive = false;
      };
    }

    checkFavorited(product.id).then((favorited) => {
      if (alive) {
        setIsFav(favorited);
      }
    });

    return () => {
      alive = false;
    };
  }, [checkFavorited, product.id, visible]);

  if (!visible) return null;

  const handleAction = async (actionId: ActionId) => {
    setSelectedAction(actionId);

    try {
      if (actionId === 'view') {
        setTimeout(() => {
          router.push(`/product/${product.id}`);
          onClose();
        }, 150);
      } else if (actionId === 'contact') {
        const encodedTitle = encodeURIComponent(product.title);
        setTimeout(() => {
          router.push(`/messages?productId=${product.id}&productTitle=${encodedTitle}`);
          onClose();
        }, 150);
      } else if (actionId === 'share') {
        try {
          await Share.share({
            message: `${product.title}\n₺${product.price.toLocaleString('tr-TR')}\n${product.brand}\n⭐ ${product.rating.toFixed(1)}`,
            title: product.title,
            url: product.image,
          });
        } catch (error) {
          console.error('Share failed:', error);
        }
        setTimeout(() => onClose(), 150);
      } else if (actionId === 'whatsapp') {
        if (product.whatsapp) {
          const message = encodeURIComponent(
            `Merhaba! Bu ürüne ilgi duydum:\n${product.title}\n₺${product.price.toLocaleString('tr-TR')}`
          );
          const whatsappUrl = `https://wa.me/${product.whatsapp}?text=${message}`;
          try {
            await Linking.openURL(whatsappUrl);
          } catch (error) {
            console.error('WhatsApp failed:', error);
            Alert.alert('Hata', 'WhatsApp açılamadı. Lütfen WhatsApp uygulamasının kurulu olduğundan emin olun.');
          }
        } else {
          Alert.alert('Bilgi', 'Bu satıcının WhatsApp numarası mevcut değil.');
        }
        setTimeout(() => onClose(), 150);
      }
    } finally {
      setSelectedAction(null);
    }
  };

  const handleToggleFavorite = async () => {
    setFavoriteLoading(true);
    try {
      const nextFavorited = await toggle(product.id);
      setIsFav(nextFavorited);
    } catch (error) {
      console.error('Favorite toggle failed:', error);
      Alert.alert('Hata', 'Favoriler güncellenemedi. Lütfen tekrar deneyin.');
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleReport = () => {
    onClose();
    setTimeout(() => {
      router.push(`/report-moderation?listingId=${product.id}&type=product`);
    }, 150);
  };

  return (
    <Pressable
      onPress={onClose}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        justifyContent: 'flex-end',
        zIndex: 999,
      }}
    >
      <Pressable
        onPress={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 16,
          paddingBottom: 24,
          maxHeight: '85%',
        }}
      >
        {/* Handle bar */}
        <View className="items-center mb-4">
          <View style={{ width: 32, height: 3, backgroundColor: '#E5E7EB', borderRadius: 2 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
        >
          {/* Product preview card */}
          <View className="flex-row gap-3 mb-6 pb-6 border-b border-[#33333315]">
            <Image
              source={{ uri: product.image }}
              style={{
                width: 80,
                height: 100,
                borderRadius: 12,
                backgroundColor: '#F1F5F9',
              }}
              resizeMode="cover"
            />
            <View className="flex-1">
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: fonts.bold,
                  fontSize: 12,
                  color: colors.textSecondary,
                }}
              >
                {sellerName ?? 'Satıcı'}
              </Text>
              <Text
                numberOfLines={2}
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 13,
                  color: colors.textPrimary,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                {product.title}
              </Text>
              <View className="flex-row items-center gap-1 mt-2">
                <Ionicons name="star" size={12} color="#F59E0B" />
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 12,
                    color: colors.textPrimary,
                  }}
                >
                  {product.rating.toFixed(1)}
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: fonts.headingBold,
                  fontSize: 14,
                  color: colors.primary,
                  marginTop: 4,
                }}
              >
                ₺{product.price.toLocaleString('tr-TR')}
              </Text>
            </View>
          </View>

          {/* Main action buttons */}
          <View style={{ gap: 10 }}>
            {ACTION_ITEMS.map((action) => {
              const isSelected = selectedAction === action.id;
              const isDisabled = action.id === 'whatsapp' && !product.whatsapp;

              return (
                <Pressable
                  key={action.id}
                  onPress={() => !isDisabled && handleAction(action.id)}
                  disabled={isDisabled}
                  style={{
                    opacity: isDisabled ? 0.5 : 1,
                    backgroundColor: isSelected ? action.color : '#F8FAFC',
                    borderColor: action.color,
                    borderWidth: isSelected ? 0 : 1,
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}
                >
                  <Ionicons
                    name={action.icon as any}
                    size={18}
                    color={isSelected ? '#fff' : action.color}
                  />
                  <Text
                    style={{
                      fontFamily: isSelected ? fonts.bold : fonts.medium,
                      fontSize: 14,
                      color: isSelected ? '#fff' : action.color,
                    }}
                  >
                    {action.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={16} color="#fff" style={{ marginLeft: 'auto' }} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Quick actions section */}
          <View className="mt-6 pt-6 border-t border-[#33333315]">
            <Text
              style={{
                fontFamily: fonts.medium,
                fontSize: 12,
                color: colors.textSecondary,
                marginBottom: 10,
              }}
            >
              Hızlı İşlemler
            </Text>
            <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
              {/* Add to favorites button */}
              <Pressable
                onPress={handleToggleFavorite}
                disabled={favoriteLoading}
                style={{
                  backgroundColor: isFav ? '#FFE4E6' : '#F8FAFC',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  flex: 1,
                  minWidth: '48%',
                  alignItems: 'center',
                  opacity: favoriteLoading ? 0.6 : 1,
                }}
              >
                <View className="flex-row items-center gap-1">
                  <Ionicons
                    name={isFav ? 'heart' : 'heart-outline'}
                    size={14}
                    color={isFav ? colors.danger : colors.textSecondary}
                  />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 11,
                      color: isFav ? colors.danger : colors.textSecondary,
                    }}
                  >
                    {isFav ? 'Favorilerde' : 'Favorilere Ekle'}
                  </Text>
                </View>
              </Pressable>

              {/* Report button */}
              <Pressable
                onPress={handleReport}
                style={{
                  backgroundColor: '#F8FAFC',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  flex: 1,
                  minWidth: '48%',
                  alignItems: 'center',
                }}
              >
                <View className="flex-row items-center gap-1">
                  <Ionicons name="flag-outline" size={14} color={colors.textSecondary} />
                  <Text
                    style={{
                      fontFamily: fonts.medium,
                      fontSize: 11,
                      color: colors.textSecondary,
                    }}
                  >
                    Şikayet Et
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Seller info section */}
          {sellerStoreId && (
            <View className="mt-6 pt-6 border-t border-[#33333315]">
              <Text
                style={{
                  fontFamily: fonts.medium,
                  fontSize: 12,
                  color: colors.textSecondary,
                  marginBottom: 10,
                }}
              >
                Satıcı
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    router.push(`/(tabs)/store?storeId=${sellerStoreId}`);
                  }, 150);
                }}
                style={{
                  backgroundColor: '#F8FAFC',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <View
                    style={{ backgroundColor: colors.primary }}
                    className="w-9 h-9 rounded-full items-center justify-center"
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: '#fff' }}>
                      {(sellerName?.charAt(0) ?? 'S').toUpperCase()}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: 12,
                        color: colors.textPrimary,
                      }}
                    >
                      {sellerName ?? 'Satıcıyı Ziyaret Et'}
                    </Text>
                    <Text
                      style={{
                        fontFamily: fonts.regular,
                        fontSize: 10,
                        color: colors.textSecondary,
                      }}
                    >
                      Mağazasını Aç
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Close button */}
        <Pressable
          onPress={onClose}
          style={{
            marginHorizontal: 16,
            marginTop: 16,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.borderLight,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontFamily: fonts.medium,
              fontSize: 14,
              color: colors.textPrimary,
            }}
          >
            Kapat
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
