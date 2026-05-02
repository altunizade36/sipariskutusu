import { useState, useCallback, useRef, useEffect } from 'react';

export interface UploadProgress {
  isUploading: boolean;
  progress: number; // 0-100
  message: string;
  error: string | null;
}

export function useUploadProgress() {
  const [state, setState] = useState<UploadProgress>({
    isUploading: false,
    progress: 0,
    message: '',
    error: null,
  });

  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startUpload = useCallback((totalFiles: number = 1) => {
    setState({
      isUploading: true,
      progress: 0,
      message: `Yükleniyor... (0/${totalFiles})`,
      error: null,
    });

    // Simulate progress with exponential backoff
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress = Math.min(currentProgress + Math.random() * 30, 95);
      setState(prev => ({
        ...prev,
        progress: currentProgress,
        message: `Yükleniyor... ${Math.round(currentProgress)}%`,
      }));
    }, 500);
  }, []);

  const updateProgress = useCallback((progress: number, currentFile?: number, totalFiles?: number) => {
    setState(prev => ({
      ...prev,
      progress,
      message: currentFile && totalFiles 
        ? `Yükleniyor... (${currentFile}/${totalFiles})`
        : `Yükleniyor... ${Math.round(progress)}%`,
    }));
  }, []);

  const completeUpload = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setState({
      isUploading: false,
      progress: 100,
      message: 'Tamamlandı ✓',
      error: null,
    });
  }, []);

  const failUpload = useCallback((error: string) => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setState({
      isUploading: false,
      progress: 0,
      message: '',
      error,
    });
  }, []);

  const resetProgress = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    setState({
      isUploading: false,
      progress: 0,
      message: '',
      error: null,
    });
  }, []);

  return {
    ...state,
    startUpload,
    updateProgress,
    completeUpload,
    failUpload,
    resetProgress,
  };
}
