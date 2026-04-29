import React, { createContext, useContext, useState, useCallback } from 'react';

export interface StateContextConfig<T> {
  initialState: T;
  name?: string;
}

export interface StateContextType<T> {
  state: T;
  setState: (newState: T | ((prevState: T) => T)) => void;
  reset: () => void;
}

export function createStateContext<T>(config: StateContextConfig<T>) {
  const Context = createContext<StateContextType<T> | undefined>(undefined);

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<T>(config.initialState);

    const reset = useCallback(() => {
      setState(config.initialState);
    }, []);

    const value: StateContextType<T> = {
      state,
      setState,
      reset,
    };

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  const useContextState = (): StateContextType<T> => {
    const context = useContext(Context);
    if (!context) {
      throw new Error(
        `use${config.name || 'StateContext'} must be used within ${config.name || 'StateContext'}Provider`,
      );
    }
    return context;
  };

  return {
    Provider,
    useContextState,
    Context,
  };
}

export function createAsyncStateContext<T, E = Error>(config: StateContextConfig<T>) {
  const Context = createContext<{
    state: T;
    setState: (newState: T | ((prevState: T) => T)) => void;
    loading: boolean;
    error: E | null;
    setLoading: (loading: boolean) => void;
    setError: (error: E | null) => void;
    reset: () => void;
  } | undefined>(undefined);

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<T>(config.initialState);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<E | null>(null);

    const reset = useCallback(() => {
      setState(config.initialState);
      setLoading(false);
      setError(null);
    }, []);

    const value = {
      state,
      setState,
      loading,
      error,
      setLoading,
      setError,
      reset,
    };

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  const useAsyncState = () => {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`useAsyncState must be used within AsyncStateProvider`);
    }
    return context;
  };

  return {
    Provider,
    useAsyncState,
    Context,
  };
}

export function createMultiStateContext<T extends Record<string, any>>(
  config: StateContextConfig<T>,
) {
  const Context = createContext<{
    states: T;
    setState: <K extends keyof T>(key: K, value: T[K] | ((prev: T[K]) => T[K])) => void;
    reset: () => void;
  } | undefined>(undefined);

  const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [states, setStates] = useState<T>(config.initialState);

    const setState = useCallback(<K extends keyof T>(
      key: K,
      value: T[K] | ((prev: T[K]) => T[K]),
    ) => {
      setStates((prevStates) => ({
        ...prevStates,
        [key]: typeof value === 'function' ? (value as any)(prevStates[key]) : value,
      }));
    }, []);

    const reset = useCallback(() => {
      setStates(config.initialState);
    }, []);

    const value = {
      states,
      setState,
      reset,
    };

    return <Context.Provider value={value}>{children}</Context.Provider>;
  };

  const useMultiState = () => {
    const context = useContext(Context);
    if (!context) {
      throw new Error(`useMultiState must be used within MultiStateProvider`);
    }
    return context;
  };

  return {
    Provider,
    useMultiState,
    Context,
  };
}
