import { Share } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ExportData {
  favorites: string[];
  searchHistory: string[];
  recentlyViewed: string[];
  collections: any[];
  preferences: any;
  exportedAt: string;
  version: string;
}

export class DataExportService {
  static async exportUserData(): Promise<ExportData> {
    try {
      const [favorites, searchHistory, recentlyViewed, collections, preferences] = await Promise.all([
        AsyncStorage.getItem('@sipariskutusu/favorites'),
        AsyncStorage.getItem('@sipariskutusu/search_history'),
        AsyncStorage.getItem('@sipariskutusu/recently_viewed'),
        AsyncStorage.getItem('@sipariskutusu/collections'),
        AsyncStorage.getItem('@sipariskutusu/user_prefs'),
      ]);

      return {
        favorites: favorites ? JSON.parse(favorites) : [],
        searchHistory: searchHistory ? JSON.parse(searchHistory) : [],
        recentlyViewed: recentlyViewed ? JSON.parse(recentlyViewed) : [],
        collections: collections ? JSON.parse(collections) : [],
        preferences: preferences ? JSON.parse(preferences) : {},
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }

  static async exportAsJSON(): Promise<string> {
    try {
      const data = await this.exportUserData();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      console.error('Failed to export as JSON:', error);
      throw error;
    }
  }

  static async shareExportedData(): Promise<void> {
    try {
      const jsonData = await this.exportAsJSON();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      await Share.share({
        message: `Siparişkutusu Kullanıcı Verileri\n\n${jsonData}`,
        title: `sipariskutusu_export_${timestamp}`,
      });
    } catch (error) {
      console.error('Failed to share exported data:', error);
      throw error;
    }
  }

  static async importUserData(jsonData: string): Promise<boolean> {
    try {
      const data: ExportData = JSON.parse(jsonData);

      if (data.version !== '1.0') {
        throw new Error('Unsupported export version');
      }

      await Promise.all([
        AsyncStorage.setItem('@sipariskutusu/favorites', JSON.stringify(data.favorites)),
        AsyncStorage.setItem('@sipariskutusu/search_history', JSON.stringify(data.searchHistory)),
        AsyncStorage.setItem('@sipariskutusu/recently_viewed', JSON.stringify(data.recentlyViewed)),
        AsyncStorage.setItem('@sipariskutusu/collections', JSON.stringify(data.collections)),
        AsyncStorage.setItem('@sipariskutusu/user_prefs', JSON.stringify(data.preferences)),
      ]);

      return true;
    } catch (error) {
      console.error('Failed to import user data:', error);
      return false;
    }
  }

  static async getExportSize(): Promise<number> {
    try {
      const json = await this.exportAsJSON();
      return json.length;
    } catch (error) {
      console.error('Failed to get export size:', error);
      return 0;
    }
  }
}
