import { Share, Alert } from 'react-native';
import { useAuth } from '../context/AuthContext';

export async function shareWishlist(wishlistName: string, productCount: number) {
  try {
    const message = `${wishlistName} - ${productCount} ürün içeriyor. Siparişkutusu uygulamasında keşfet! 🛍️`;
    
    const result = await Share.share({
      message,
      title: `${wishlistName} İstek Listesi`,
      url: 'https://sipariskutusu.com', // Replace with actual app link
    });

    if (result.action === Share.sharedAction) {
      return { success: true, shared: true };
    }
  } catch (error) {
    Alert.alert('Hata', 'İstek listesi paylaşılamadı.');
    return { success: false, error };
  }
}

export async function shareProductLink(productId: string, productTitle: string, price: number) {
  try {
    const message = `${productTitle} - ₺${price.toFixed(2)}\n\nSiparişkutusu uygulamasında keşfet! 🛍️`;
    
    const result = await Share.share({
      message,
      title: productTitle,
    });

    if (result.action === Share.sharedAction) {
      return { success: true, shared: true };
    }
  } catch (error) {
    return { success: false, error };
  }
}

export async function shareStoreProfile(storeName: string, sellerName: string) {
  try {
    const message = `${storeName} (@${sellerName}) mağazasını takip et! Siparişkutusu uygulamasında keşfet! 🛍️`;
    
    const result = await Share.share({
      message,
      title: `${storeName} Mağazası`,
    });

    if (result.action === Share.sharedAction) {
      return { success: true, shared: true };
    }
  } catch (error) {
    return { success: false, error };
  }
}
