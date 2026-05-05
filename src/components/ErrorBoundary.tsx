import React, { ReactNode, useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
    this.props.onError?.(error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <View className="flex-1 bg-white items-center justify-center px-4">
          <Ionicons name="alert-circle" size={64} color={colors.danger} />
          <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.textPrimary, marginTop: 16 }}>
            Bir Hata Oluştu
          </Text>
          <Text style={{ fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center' }}>
            Uygulamada beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin.
          </Text>
          <ScrollView className="mt-4 w-full" style={{ maxHeight: 150 }}>
            <Text style={{ fontFamily: fonts.regular, fontSize: 11, color: colors.textMuted }}>
              {this.state.error.toString()}
            </Text>
          </ScrollView>
          <Pressable
            onPress={this.handleRetry}
            className="mt-6 bg-[#111827] px-6 py-3 rounded-lg"
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 13, color: '#fff' }}>
              Tekrar Dene
            </Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

export function useErrorHandler() {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) {
      console.error('Error handled:', error);
    }
  }, [error]);

  const handleError = (err: Error) => {
    setError(err);
  };

  const clearError = () => {
    setError(null);
  };

  const resetError = () => {
    setError(null);
  };

  return { error, handleError, clearError, resetError };
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, retry: () => void) => ReactNode,
) {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
