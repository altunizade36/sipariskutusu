import { useState, useCallback } from 'react';

export interface ModalState {
  id: string;
  title?: string;
  content?: any;
  isVisible: boolean;
  isFullScreen?: boolean;
  onClose?: () => void;
}

export function useModalManager() {
  const [modals, setModals] = useState<ModalState[]>([]);

  const openModal = useCallback(
    (
      id: string,
      content: any,
      options?: { title?: string; isFullScreen?: boolean; onClose?: () => void },
    ) => {
      setModals((prev) => {
        const existing = prev.find((m) => m.id === id);
        if (existing) {
          return prev.map((m) =>
            m.id === id ? { ...m, isVisible: true, content } : m,
          );
        }

        return [
          ...prev,
          {
            id,
            content,
            isVisible: true,
            title: options?.title,
            isFullScreen: options?.isFullScreen,
            onClose: options?.onClose,
          },
        ];
      });
    },
    [],
  );

  const closeModal = useCallback((id: string) => {
    setModals((prev) =>
      prev.map((m) =>
        m.id === id
          ? {
              ...m,
              isVisible: false,
            }
          : m,
      ),
    );

    // Remove after animation
    setTimeout(() => {
      setModals((prev) => prev.filter((m) => m.id !== id));
    }, 300);
  }, []);

  const closeAllModals = useCallback(() => {
    setModals((prev) =>
      prev.map((m) => ({
        ...m,
        isVisible: false,
      })),
    );

    setTimeout(() => {
      setModals([]);
    }, 300);
  }, []);

  const updateModal = useCallback(
    (id: string, updates: Partial<ModalState>) => {
      setModals((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
      );
    },
    [],
  );

  return {
    modals,
    openModal,
    closeModal,
    closeAllModals,
    updateModal,
  };
}

interface ModalManagerProps {
  modals: ModalState[];
  onClose: (id: string) => void;
}

// Note: Render modals in your root component using the modal states
// Use the hook's modals array to render modals conditionally
