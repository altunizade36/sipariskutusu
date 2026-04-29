import AsyncStorage from '@react-native-async-storage/async-storage';

export interface FileMetadata {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  createdAt: number;
  lastModified: number;
  uri?: string;
}

export interface FileStorageStats {
  totalFiles: number;
  totalSize: number;
  oldestFile?: FileMetadata;
  largestFile?: FileMetadata;
}

export class FileStorageManager {
  private static metadataKey = 'app:files:metadata';
  private static maxTotalSize = 50 * 1024 * 1024; // 50MB

  static async saveFile(
    id: string,
    data: string,
    metadata: Partial<FileMetadata> = {},
  ): Promise<FileMetadata> {
    try {
      const fileMetadata: FileMetadata = {
        id,
        filename: metadata.filename || `file_${id}`,
        size: data.length,
        mimeType: metadata.mimeType || 'application/octet-stream',
        createdAt: metadata.createdAt || Date.now(),
        lastModified: Date.now(),
        uri: metadata.uri,
      };

      // Store metadata
      const allMetadata = await this.getAllMetadata();
      allMetadata[id] = fileMetadata;
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(allMetadata));

      // Store file data
      await AsyncStorage.setItem(`app:file:${id}`, data);

      return fileMetadata;
    } catch (error) {
      console.error(`Failed to save file ${id}:`, error);
      throw error;
    }
  }

  static async getFile(id: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(`app:file:${id}`);
    } catch (error) {
      console.error(`Failed to get file ${id}:`, error);
      return null;
    }
  }

  static async getFileMetadata(id: string): Promise<FileMetadata | null> {
    try {
      const metadata = await this.getAllMetadata();
      return metadata[id] || null;
    } catch (error) {
      console.error(`Failed to get metadata for ${id}:`, error);
      return null;
    }
  }

  static async deleteFile(id: string): Promise<boolean> {
    try {
      await AsyncStorage.removeItem(`app:file:${id}`);
      const metadata = await this.getAllMetadata();
      delete metadata[id];
      await AsyncStorage.setItem(this.metadataKey, JSON.stringify(metadata));
      return true;
    } catch (error) {
      console.error(`Failed to delete file ${id}:`, error);
      return false;
    }
  }

  static async getAllMetadata(): Promise<Record<string, FileMetadata>> {
    try {
      const data = await AsyncStorage.getItem(this.metadataKey);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Failed to get all metadata:', error);
      return {};
    }
  }

  static async getStats(): Promise<FileStorageStats> {
    try {
      const metadata = await this.getAllMetadata();
      const files = Object.values(metadata);

      let totalSize = 0;
      let oldestFile: FileMetadata | undefined;
      let largestFile: FileMetadata | undefined;

      files.forEach((file) => {
        totalSize += file.size;

        if (!oldestFile || file.createdAt < oldestFile.createdAt) {
          oldestFile = file;
        }

        if (!largestFile || file.size > largestFile.size) {
          largestFile = file;
        }
      });

      return {
        totalFiles: files.length,
        totalSize,
        oldestFile,
        largestFile,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  static async cleanup(olderThanDays: number = 30): Promise<number> {
    try {
      const metadata = await this.getAllMetadata();
      const now = Date.now();
      const timeThreshold = olderThanDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const [id, file] of Object.entries(metadata)) {
        if (now - file.createdAt > timeThreshold) {
          await this.deleteFile(id);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Failed to cleanup files:', error);
      return 0;
    }
  }

  static async clear(): Promise<void> {
    try {
      const metadata = await this.getAllMetadata();
      for (const id of Object.keys(metadata)) {
        await AsyncStorage.removeItem(`app:file:${id}`);
      }
      await AsyncStorage.removeItem(this.metadataKey);
    } catch (error) {
      console.error('Failed to clear all files:', error);
    }
  }
}
