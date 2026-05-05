import { useCallback, useState } from 'react';
import { Share, Alert } from 'react-native';

export interface ClipboardEntry {
  id: string;
  content: string;
  type: 'text' | 'link' | 'price' | 'productId';
  timestamp: number;
}

export function useClipboard() {
  const [clipboard, setClipboard] = useState<ClipboardEntry[]>([]);

  const copyToClipboard = useCallback(
    async (content: string, type: ClipboardEntry['type'] = 'text'): Promise<boolean> => {
      try {
        // Using Share API as a workaround for clipboard
        await Share.share({
          message: content,
        });

        const entry: ClipboardEntry = {
          id: `clip_${Date.now()}`,
          content,
          type,
          timestamp: Date.now(),
        };

        setClipboard((prev) => [entry, ...prev].slice(0, 10));
        return true;
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
      }
    },
    [],
  );

  const getFromClipboard = useCallback(async (): Promise<string | null> => {
    try {
      // Note: Getting clipboard content is restricted in mobile for security
      return null;
    } catch (error) {
      console.error('Failed to get from clipboard:', error);
      return null;
    }
  }, []);

  const copyProductLink = useCallback(
    async (productId: string, productTitle: string): Promise<boolean> => {
      const link = `sipariskutusu://product/${productId}`;
      const content = `${productTitle}\n${link}`;
      return copyToClipboard(content, 'link');
    },
    [copyToClipboard],
  );

  const copyPrice = useCallback(
    async (price: number): Promise<boolean> => {
      return copyToClipboard(`₺${price.toFixed(2)}`, 'price');
    },
    [copyToClipboard],
  );

  const clearClipboard = useCallback(() => {
    setClipboard([]);
  }, []);

  return {
    clipboard,
    copyToClipboard,
    getFromClipboard,
    copyProductLink,
    copyPrice,
    clearClipboard,
  };
}
