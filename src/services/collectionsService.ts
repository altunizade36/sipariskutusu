import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Collection {
  id: string;
  name: string;
  description?: string;
  productIds: string[];
  createdAt: number;
  updatedAt: number;
  isPrivate: boolean;
}

const COLLECTIONS_KEY = '@sipariskutusu/collections';

export class CollectionsService {
  static async createCollection(
    name: string,
    description?: string,
    isPrivate = true,
  ): Promise<Collection> {
    try {
      const collections = await this.getAllCollections();
      const id = `col_${Date.now()}`;
      const newCollection: Collection = {
        id,
        name,
        description,
        productIds: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPrivate,
      };

      collections.push(newCollection);
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return newCollection;
    } catch (error) {
      console.error('Failed to create collection:', error);
      throw error;
    }
  }

  static async getCollection(id: string): Promise<Collection | null> {
    try {
      const collections = await this.getAllCollections();
      return collections.find((c) => c.id === id) || null;
    } catch (error) {
      console.error('Failed to get collection:', error);
      return null;
    }
  }

  static async getAllCollections(): Promise<Collection[]> {
    try {
      const data = await AsyncStorage.getItem(COLLECTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get collections:', error);
      return [];
    }
  }

  static async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | null> {
    try {
      const collections = await this.getAllCollections();
      const index = collections.findIndex((c) => c.id === id);

      if (index === -1) return null;

      collections[index] = {
        ...collections[index],
        ...updates,
        updatedAt: Date.now(),
      };

      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
      return collections[index];
    } catch (error) {
      console.error('Failed to update collection:', error);
      return null;
    }
  }

  static async deleteCollection(id: string): Promise<boolean> {
    try {
      const collections = await this.getAllCollections();
      const filtered = collections.filter((c) => c.id !== id);
      await AsyncStorage.setItem(COLLECTIONS_KEY, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete collection:', error);
      return false;
    }
  }

  static async addProductToCollection(collectionId: string, productId: string): Promise<boolean> {
    try {
      const collection = await this.getCollection(collectionId);
      if (!collection) return false;

      if (!collection.productIds.includes(productId)) {
        collection.productIds.push(productId);
        await this.updateCollection(collectionId, collection);
      }
      return true;
    } catch (error) {
      console.error('Failed to add product to collection:', error);
      return false;
    }
  }

  static async removeProductFromCollection(collectionId: string, productId: string): Promise<boolean> {
    try {
      const collection = await this.getCollection(collectionId);
      if (!collection) return false;

      collection.productIds = collection.productIds.filter((id) => id !== productId);
      await this.updateCollection(collectionId, collection);
      return true;
    } catch (error) {
      console.error('Failed to remove product from collection:', error);
      return false;
    }
  }

  static async getCollectionsForProduct(productId: string): Promise<Collection[]> {
    try {
      const collections = await this.getAllCollections();
      return collections.filter((c) => c.productIds.includes(productId));
    } catch (error) {
      console.error('Failed to get collections for product:', error);
      return [];
    }
  }

  static async duplicateCollection(id: string, newName: string): Promise<Collection | null> {
    try {
      const original = await this.getCollection(id);
      if (!original) return null;

      return this.createCollection(newName, original.description, original.isPrivate);
    } catch (error) {
      console.error('Failed to duplicate collection:', error);
      return null;
    }
  }

  static async clearAllCollections(): Promise<void> {
    try {
      await AsyncStorage.removeItem(COLLECTIONS_KEY);
    } catch (error) {
      console.error('Failed to clear collections:', error);
    }
  }
}
