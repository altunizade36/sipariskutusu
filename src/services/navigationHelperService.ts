import { useRouter } from 'expo-router';
import { EventBus, AppEvents } from './eventBusService';

export interface DeepLink {
  scheme: string;
  path: string;
  params?: Record<string, string>;
}

export interface Route {
  name: string;
  path: string;
  params?: Record<string, any>;
}

export class NavigationHelper {
  private static router: any = null;

  static setRouter(router: any) {
    this.router = router;
  }

  static getRouter() {
    return this.router;
  }

  static navigate(path: string, params?: Record<string, any>) {
    if (!this.router) {
      console.warn('Router not initialized');
      return;
    }

    if (params) {
      this.router.push({
        pathname: path,
        params,
      });
    } else {
      this.router.push(path);
    }
  }

  static navigateNested(path: string, params?: Record<string, any>) {
    if (!this.router) {
      console.warn('Router not initialized');
      return;
    }

    this.router.navigate({
      pathname: path,
      params,
    });
  }

  static replace(path: string, params?: Record<string, any>) {
    if (!this.router) {
      console.warn('Router not initialized');
      return;
    }

    if (params) {
      this.router.replace({
        pathname: path,
        params,
      });
    } else {
      this.router.replace(path);
    }
  }

  static back() {
    if (!this.router) {
      console.warn('Router not initialized');
      return;
    }

    this.router.back();
  }

  static canGoBack(): boolean {
    if (!this.router) return false;
    return this.router.canGoBack?.();
  }

  static goToHome() {
    this.replace('/(tabs)');
  }

  static goToProduct(productId: string) {
    this.navigate(`/product/${productId}`);
  }

  static goToStore(storeId: string) {
    this.navigate(`/store/${storeId}`);
  }

  static goToCategory(slug: string) {
    this.navigate(`/category/${slug}`);
  }

  static goToSearch(query?: string) {
    if (query) {
      this.navigate('/search', { q: query });
    } else {
      this.navigate('/search');
    }
  }

  static goToProfile() {
    this.navigate('/(tabs)/account');
  }

  static goToMessages() {
    this.navigate('/(tabs)/messages');
  }

  static goToCart() {
    this.navigate('/(tabs)/cart');
  }

  static goToLogin() {
    this.replace('/auth');
  }

  static goToCreateListing() {
    this.navigate('/create-listing');
  }

  static goToListingStep(step: number) {
    this.navigate(`/listing/step-${step}`);
  }

  static goToSettings() {
    this.navigate('/(tabs)/account');
  }

  static handleDeepLink(url: string) {
    const link = this.parseDeepLink(url);
    EventBus.emit(AppEvents.DEEP_LINK_RECEIVED, link);

    if (link.scheme === 'sipariskutusu') {
      this.routeDeepLink(link);
    }
  }

  private static parseDeepLink(url: string): DeepLink {
    try {
      const urlObj = new URL(url);
      const scheme = urlObj.protocol.replace(':', '');
      const path = urlObj.pathname;
      const params: Record<string, string> = {};

      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      return { scheme, path, params };
    } catch (error) {
      console.error('Failed to parse deep link:', error);
      return { scheme: '', path: '' };
    }
  }

  private static routeDeepLink(link: DeepLink) {
    const { path, params } = link;

    if (path.includes('/product/')) {
      const productId = path.split('/product/')[1];
      if (productId) this.goToProduct(productId);
    } else if (path.includes('/store/')) {
      const storeId = path.split('/store/')[1];
      if (storeId) this.goToStore(storeId);
    } else if (path.includes('/category/')) {
      const slug = path.split('/category/')[1];
      if (slug) this.goToCategory(slug);
    } else if (path.includes('/search')) {
      this.goToSearch(params?.q);
    } else if (path === '/home') {
      this.goToHome();
    } else if (path === '/profile') {
      this.goToProfile();
    } else if (path === '/messages') {
      this.goToMessages();
    } else if (path === '/cart') {
      this.goToCart();
    }
  }

  static getNavigationStack(): string[] {
    if (!this.router) return [];
    return this.router.state?.routes?.map((r: any) => r.name) || [];
  }

  static isCurrentRoute(routeName: string): boolean {
    if (!this.router) return false;
    const current = this.router.state?.routes?.[this.router.state.routes.length - 1];
    return current?.name === routeName;
  }

  static generateDeepLink(type: string, id: string, params?: Record<string, string>): string {
    const baseUrl = 'sipariskutusu://';
    let url = `${baseUrl}${type}/${id}`;

    if (params) {
      const queryString = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      url += `?${queryString}`;
    }

    return url;
  }

  static generateProductLink(productId: string): string {
    return this.generateDeepLink('product', productId);
  }

  static generateStoreLink(storeId: string): string {
    return this.generateDeepLink('store', storeId);
  }

  static generateCategoryLink(categorySlug: string): string {
    return this.generateDeepLink('category', categorySlug);
  }
}
