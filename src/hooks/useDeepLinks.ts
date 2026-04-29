import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';

export interface DeepLinkConfig {
  path: string;
  handler: (params: Record<string, any>) => void;
}

export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const route = url.replace(/.*?:\/\/?/, '');
      const routeName = route.split('/')[0];
      const params = parseDeepLink(route);

      switch (routeName) {
        case 'product':
          if (params.id) {
            router.push(`/product/${params.id}`);
          }
          break;
        case 'store':
          if (params.sellerId) {
            router.push(`/(tabs)/store?sellerId=${params.sellerId}`);
          }
          break;
        case 'search':
          if (params.query) {
            router.push(`/search?q=${params.query}`);
          }
          break;
        case 'category':
          if (params.slug) {
            router.push(`/category/${params.slug}`);
          }
          break;
        case 'collection':
          if (params.id) {
            // Navigate to collection (implementation depends on collections UI)
          }
          break;
        case 'messages':
          router.push('/(tabs)/messages');
          break;
        case 'favorites':
          router.push('/(tabs)/favorites');
          break;
        case 'profile':
          router.push('/(tabs)/account');
          break;
        default:
          break;
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Check for initial URL
    Linking.getInitialURL().then((url) => {
      if (url != null) {
        handleUrl({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);
}

function parseDeepLink(url: string): Record<string, any> {
  const params: Record<string, any> = {};
  const parts = url.split('?');

  if (parts.length > 1) {
    const queryParams = parts[1].split('&');
    queryParams.forEach((param) => {
      const [key, value] = param.split('=');
      params[key] = decodeURIComponent(value);
    });
  }

  return params;
}

export function createDeepLink(
  route: string,
  params?: Record<string, any>,
): string {
  const baseUrl = 'sipariskutusu://';
  const queryString = params
    ? '?' + Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
        .join('&')
    : '';

  return `${baseUrl}${route}${queryString}`;
}

export const DEEP_LINKS = {
  product: (id: string) => createDeepLink('product', { id }),
  store: (sellerId: string) => createDeepLink('store', { sellerId }),
  search: (query: string) => createDeepLink('search', { query }),
  category: (slug: string) => createDeepLink('category', { slug }),
  collection: (id: string) => createDeepLink('collection', { id }),
  messages: () => createDeepLink('messages'),
  favorites: () => createDeepLink('favorites'),
  profile: () => createDeepLink('profile'),
};
