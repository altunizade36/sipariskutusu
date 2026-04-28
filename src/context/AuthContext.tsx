import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabase';
import { identifyUser, resetUser, setSentryUser } from '../services/monitoring';
import { backendRequest, isBackendApiConfigured, isBackendStrictMode } from '../services/backendApiClient';
import { getCacheValue, removeCacheValue, setCacheValue } from '../services/noSqlStore';
import { AUTH_ME_CACHE_PREFIX } from '../constants/cacheKeys';
import { deactivateMyPushTokens } from '../services/pushNotificationService';
import { AUTH_REDIRECT_URL, PASSWORD_RESET_REDIRECT_URL } from '../utils/authRedirect';

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isConfigured: boolean;
  isLoading: boolean;
  isUserVerified: boolean;
  isDarkMode: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  toggleDarkMode: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (email: string, password: string, fullName?: string, accountRole?: 'buyer' | 'seller') => Promise<void>;
  signInWithGoogle: () => Promise<boolean>;
  signInWithApple: () => Promise<boolean>;
  sendEmailOtp: (email: string, shouldCreateUser?: boolean) => Promise<void>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  sendPhoneOtp: (phone: string) => Promise<void>;
  verifyPhoneOtp: (phone: string, code: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshUser: () => Promise<User | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const DEMO_ACCOUNTS = {
  buyer: {
    email: 'alici@sipariskutusu.demo',
    password: 'Demo123!',
    fullName: 'Demo Alıcı',
  },
  seller: {
    email: 'satici@sipariskutusu.demo',
    password: 'Demo123!',
    fullName: 'Demo Satıcı',
  },
} as const;

function resolveDemoAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  if (
    normalizedEmail === DEMO_ACCOUNTS.buyer.email &&
    normalizedPassword === DEMO_ACCOUNTS.buyer.password
  ) {
    return DEMO_ACCOUNTS.buyer;
  }

  if (
    normalizedEmail === DEMO_ACCOUNTS.seller.email &&
    normalizedPassword === DEMO_ACCOUNTS.seller.password
  ) {
    return DEMO_ACCOUNTS.seller;
  }

  return null;
}

function buildDemoUser(email: string, fullName: string, accountRole: 'buyer' | 'seller' = 'buyer'): User {
  const now = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  return {
    id: `demo-${normalizedEmail}`,
    aud: 'authenticated',
    role: 'authenticated',
    email: normalizedEmail,
    phone: '',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
    },
    user_metadata: {
      full_name: fullName,
      demo: true,
      account_role: accountRole,
      seller_intent: accountRole === 'seller',
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User;
}

function parseAuthTokensFromUrl(url: string) {
  const hashPart = url.includes('#') ? url.split('#')[1] : '';
  const queryPart = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hashParams = new URLSearchParams(hashPart);
  const queryParams = new URLSearchParams(queryPart);

  return {
    accessToken: hashParams.get('access_token') ?? queryParams.get('access_token'),
    refreshToken: hashParams.get('refresh_token') ?? queryParams.get('refresh_token'),
    code: hashParams.get('code') ?? queryParams.get('code'),
  };
}

function hasVerifiedContact(user: User | null) {
  if (!user) return false;

  const emailConfirmedAt = (user as User & { email_confirmed_at?: string | null }).email_confirmed_at;
  const phoneConfirmedAt = (user as User & { phone_confirmed_at?: string | null }).phone_confirmed_at;

  return Boolean(emailConfirmedAt || phoneConfirmedAt);
}

const AUTH_ME_CACHE_TTL_MS = 60_000;

type BackendAuthSessionPayload = {
  accessToken?: string;
  refreshToken?: string;
  requiresEmailVerification?: boolean;
  message?: string;
};

type BackendAuthMePayload = {
  user?: User | null;
};

function assertBackendAuthSessionPayload(payload: unknown): BackendAuthSessionPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Auth cevabi gecersiz formatta.');
  }

  const parsed = payload as Partial<BackendAuthSessionPayload>;

  if (parsed.accessToken !== undefined && typeof parsed.accessToken !== 'string') {
    throw new Error('Auth cevabinda accessToken string olmali.');
  }

  if (parsed.refreshToken !== undefined && typeof parsed.refreshToken !== 'string') {
    throw new Error('Auth cevabinda refreshToken string olmali.');
  }

  if (
    parsed.requiresEmailVerification !== undefined &&
    typeof parsed.requiresEmailVerification !== 'boolean'
  ) {
    throw new Error('Auth cevabinda requiresEmailVerification boolean olmali.');
  }

  if (parsed.message !== undefined && typeof parsed.message !== 'string') {
    throw new Error('Auth cevabinda message string olmali.');
  }

  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken,
    requiresEmailVerification: parsed.requiresEmailVerification,
    message: parsed.message,
  };
}

function assertBackendAuthOkPayload(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Auth islem cevabi gecersiz formatta.');
  }

  const parsed = payload as { ok?: unknown; message?: unknown };

  if (parsed.ok !== undefined && typeof parsed.ok !== 'boolean') {
    throw new Error('Auth islem cevabinda ok boolean olmali.');
  }

  if (parsed.message !== undefined && typeof parsed.message !== 'string') {
    throw new Error('Auth islem cevabinda message string olmali.');
  }

  return {
    ok: parsed.ok as boolean | undefined,
    message: parsed.message as string | undefined,
  };
}

function assertBackendAuthMePayload(payload: unknown): BackendAuthMePayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Auth me cevabi gecersiz formatta.');
  }

  const parsed = payload as { user?: unknown };

  if (parsed.user !== undefined && parsed.user !== null && typeof parsed.user !== 'object') {
    throw new Error('Auth me cevabinda user nesne olmali.');
  }

  return {
    user: (parsed.user ?? null) as User | null,
  };
}

/**
 * Türkiye ve diğer numaraları E.164 formatına çevirir.
 * Örnekler: "05321234567" → "+905321234567", "5321234567" → "+905321234567"
 */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+9${digits}`;
  if (digits.length === 10) return `+90${digits}`;
  // Zaten + ile başlıyorsa olduğu gibi döndür
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${digits}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoUser, setDemoUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const syncMonitoringUser = (nextSession: Session | null) => {
    const nextUser = nextSession?.user ?? null;
    if (nextUser) {
      setSentryUser(nextUser.id, nextUser.email);
      identifyUser(nextUser.id, {
        email: nextUser.email ?? null,
      });
      return;
    }

    setSentryUser(null);
    resetUser();
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      syncMonitoringUser(data.session ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      syncMonitoringUser(nextSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = getSupabaseClient();

    const handleStateChange = async (state: AppStateStatus) => {
      if (state !== 'active') {
        return;
      }

      try {
        const {
          data: { session: activeSession },
        } = await supabase.auth.getSession();

        if (activeSession) {
          await supabase.auth.refreshSession();
        }
      } catch {
        // Refresh hatası kullanıcı akışını bloklamamalı.
      }
    };

    const subscription = AppState.addEventListener('change', handleStateChange);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const supabase = getSupabaseClient();

    async function hydrateSessionFromUrl(url: string | null) {
      if (!url) {
        return;
      }

      const { accessToken, refreshToken, code } = parseAuthTokensFromUrl(url);

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          throw error;
        }

        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          throw error;
        }
      }
    }

    hydrateSessionFromUrl(null).catch(() => undefined);

    Linking.getInitialURL()
      .then((url) => hydrateSessionFromUrl(url))
      .catch(() => undefined)
      .finally(() => setIsLoading(false));

    const subscription = Linking.addEventListener('url', ({ url }) => {
      hydrateSessionFromUrl(url).catch(() => undefined);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const guardConfigured = () => {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase yapılandırması eksik. .env dosyasını doldurun.');
      }
    };

    const currentUser = session?.user ?? demoUser;
    const isDemoUser = Boolean((demoUser?.user_metadata as { demo?: boolean } | undefined)?.demo);
    const isUserVerified = isDemoUser || hasVerifiedContact(currentUser);

    const signInWithOAuthProvider = async (provider: 'google' | 'apple'): Promise<boolean> => {
      guardConfigured();
      const supabase = getSupabaseClient();
      const redirectTo = AUTH_REDIRECT_URL;
      const queryParams =
        provider === 'google'
          ? {
              access_type: 'offline',
              prompt: 'consent',
            }
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams,
        },
      });

      if (error) throw error;
      if (!data?.url) {
        throw new Error(`${provider} giriş URL oluşturulamadı.`);
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== 'success' || !result.url) {
        return false;
      }

      const { accessToken, refreshToken, code } = parseAuthTokensFromUrl(result.url);

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) throw sessionError;
        return true;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        return true;
      }

      return false;
    };

    const setSessionFromBackendPayload = async (payload: BackendAuthSessionPayload) => {
      if (!isSupabaseConfigured) {
        throw new Error('Backend auth oturumu için Supabase yapılandırması gerekli.');
      }

      if (!payload.accessToken || !payload.refreshToken) {
        throw new Error(payload.message || 'Backend auth oturumu oluşturulamadı.');
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.setSession({
        access_token: payload.accessToken,
        refresh_token: payload.refreshToken,
      });

      if (error) {
        throw error;
      }
    };

    const tryBackendAuthRequest = async <T,>(
      path: string,
      body: Record<string, unknown>,
      options?: { requireAuth?: boolean },
    ): Promise<T | null> => {
      if (!isBackendApiConfigured) {
        return null;
      }

      try {
        return await backendRequest<T>(path, {
          method: 'POST',
          body,
          requireAuth: options?.requireAuth ?? false,
          responseValidator: (response) => response as T,
        });
      } catch (error) {
        if (isBackendStrictMode) {
          throw error;
        }

        return null;
      }
    };

    return {
      user: currentUser,
      session,
      isConfigured: isSupabaseConfigured,
      isLoading,
      isUserVerified,
      isDarkMode,
      async signInWithPassword(email, password) {
        const normalizedEmail = email.trim().toLowerCase();
        const demoAccount = resolveDemoAccount(email, password);
        if (demoAccount) {
          setDemoUser(buildDemoUser(demoAccount.email, demoAccount.fullName, demoAccount.email.includes('satici') ? 'seller' : 'buyer'));
          return;
        }

        const backendPayload = await tryBackendAuthRequest<BackendAuthSessionPayload>(
          '/v1/auth/login',
          {
            email: normalizedEmail,
            password,
          },
        );

        if (backendPayload) {
          await setSessionFromBackendPayload(assertBackendAuthSessionPayload(backendPayload));
          return;
        }

        if (!isSupabaseConfigured) {
          throw new Error(
            'Demo giriş için: alici@sipariskutusu.demo veya satici@sipariskutusu.demo, şifre: Demo123!',
          );
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) throw error;
      },
      async signUpWithPassword(email, password, fullName, accountRole = 'buyer') {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedFullName = fullName?.trim();

        if (!isSupabaseConfigured) {
          const normalizedName = normalizedFullName || 'Demo Kullanıcı';
          setDemoUser(buildDemoUser(normalizedEmail, normalizedName, accountRole));
          return;
        }

        const backendPayload = await tryBackendAuthRequest<BackendAuthSessionPayload>(
          '/v1/auth/signup',
          {
            email: normalizedEmail,
            password,
            fullName: normalizedFullName ?? null,
            accountRole,
          },
        );

        if (backendPayload) {
          const validatedPayload = assertBackendAuthSessionPayload(backendPayload);

          if (validatedPayload.accessToken && validatedPayload.refreshToken) {
            await setSessionFromBackendPayload(validatedPayload);
          }

          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: AUTH_REDIRECT_URL,
            data: {
              ...(normalizedFullName ? { full_name: normalizedFullName } : {}),
              account_role: accountRole,
              seller_intent: accountRole === 'seller',
            },
          },
        });
        if (error) throw error;
      },
      async signInWithGoogle() {
        return signInWithOAuthProvider('google');
      },
      async signInWithApple() {
        return signInWithOAuthProvider('apple');
      },
      async sendEmailOtp(email, shouldCreateUser = true) {
        const normalizedEmail = email.trim().toLowerCase();

        const backendPayload = await tryBackendAuthRequest<{ ok?: boolean; message?: string }>(
          '/v1/auth/otp/email/send',
          {
            email: normalizedEmail,
            shouldCreateUser,
          },
        );

        if (backendPayload) {
          assertBackendAuthOkPayload(backendPayload);
          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser,
            emailRedirectTo: AUTH_REDIRECT_URL,
          },
        });
        if (error) throw error;
      },
      async verifyEmailOtp(email, code) {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedCode = code.trim();

        const backendPayload = await tryBackendAuthRequest<BackendAuthSessionPayload>(
          '/v1/auth/otp/email/verify',
          {
            email: normalizedEmail,
            code: normalizedCode,
          },
        );

        if (backendPayload) {
          const validatedPayload = assertBackendAuthSessionPayload(backendPayload);

          if (validatedPayload.accessToken && validatedPayload.refreshToken) {
            await setSessionFromBackendPayload(validatedPayload);
          }

          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: normalizedCode,
          type: 'email',
        });
        if (error) throw error;
      },
      async sendPhoneOtp(phone) {
        const normalized = normalizePhone(phone);

        const backendPayload = await tryBackendAuthRequest<{ ok?: boolean; message?: string }>(
          '/v1/auth/otp/phone/send',
          {
            phone: normalized,
          },
        );

        if (backendPayload) {
          assertBackendAuthOkPayload(backendPayload);
          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.signInWithOtp({ phone: normalized });
        if (error) throw error;
      },
      async verifyPhoneOtp(phone, code) {
        const normalized = normalizePhone(phone);
        const normalizedCode = code.trim();

        const backendPayload = await tryBackendAuthRequest<BackendAuthSessionPayload>(
          '/v1/auth/otp/phone/verify',
          {
            phone: normalized,
            code: normalizedCode,
          },
        );

        if (backendPayload) {
          const validatedPayload = assertBackendAuthSessionPayload(backendPayload);

          if (validatedPayload.accessToken && validatedPayload.refreshToken) {
            await setSessionFromBackendPayload(validatedPayload);
          }

          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.verifyOtp({
          phone: normalized,
          token: normalizedCode,
          type: 'sms',
        });
        if (error) throw error;
      },
      async resetPassword(email) {
        const normalizedEmail = email.trim().toLowerCase();

        const backendPayload = await tryBackendAuthRequest<{ ok?: boolean; message?: string }>(
          '/v1/auth/password/reset',
          {
            email: normalizedEmail,
            redirectTo: PASSWORD_RESET_REDIRECT_URL,
          },
        );

        if (backendPayload) {
          assertBackendAuthOkPayload(backendPayload);
          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: PASSWORD_RESET_REDIRECT_URL,
        });
        if (error) throw error;
      },
      async updatePassword(password) {
        const backendPayload = await tryBackendAuthRequest<{ ok?: boolean; message?: string }>(
          '/v1/auth/password/update',
          {
            password,
          },
          { requireAuth: true },
        );

        if (backendPayload) {
          assertBackendAuthOkPayload(backendPayload);
          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      },
      async refreshUser() {
        const sessionUserId = session?.user?.id ?? null;
        const authMeCacheKey = sessionUserId ? `${AUTH_ME_CACHE_PREFIX}:${sessionUserId}` : null;

        if (isBackendApiConfigured) {
          try {
            const payload = await backendRequest<BackendAuthMePayload>('/v1/auth/me', {
              method: 'GET',
              requireAuth: true,
              responseValidator: assertBackendAuthMePayload,
            });

            if (payload?.user) {
              if (authMeCacheKey) {
                setCacheValue(authMeCacheKey, payload.user, { ttlMs: AUTH_ME_CACHE_TTL_MS }).catch(() => {
                  // Cache write hatasi ana akisi etkilemesin.
                });
              }

              return payload.user;
            }

            if (isBackendStrictMode) {
              throw new Error('Backend kullanıcı bilgisi alınamadı.');
            }
          } catch (error) {
            if (authMeCacheKey) {
              const cachedUser = await getCacheValue<User>(authMeCacheKey).catch(() => null);
              if (cachedUser) {
                return cachedUser;
              }
            }

            if (isBackendStrictMode) {
              throw error;
            }
          }
        }

        if (!isSupabaseConfigured) {
          return demoUser;
        }

        guardConfigured();
        const supabase = getSupabaseClient();
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;

        if (authMeCacheKey && data.user) {
          setCacheValue(authMeCacheKey, data.user, { ttlMs: AUTH_ME_CACHE_TTL_MS }).catch(() => {
            // Cache write hatasi ana akisi etkilemesin.
          });
        }

        return data.user ?? null;
      },
      async toggleDarkMode() {
        setIsDarkMode(!isDarkMode);
      },
      async login(email: string, password: string) {
        return this.signInWithPassword(email, password);
      },
      async signup(email: string, password: string, fullName: string) {
        return this.signUpWithPassword(email, password, fullName, 'buyer');
      },
      async signOut() {
        const authMeCacheKey = session?.user?.id ? `${AUTH_ME_CACHE_PREFIX}:${session.user.id}` : null;

        if (demoUser) {
          setDemoUser(null);
        }

        if (isBackendApiConfigured) {
          try {
            await backendRequest<{ ok?: boolean; message?: string }>('/v1/auth/logout', {
              method: 'POST',
              requireAuth: true,
            });
          } catch (error) {
            if (isBackendStrictMode) {
              throw error;
            }
          }
        }

        if (!isSupabaseConfigured) {
          return;
        }

        guardConfigured();
        const supabase = getSupabaseClient();

        // Oturum kapanirken tokenlari pasifleyerek stale push riskini azaltir.
        await deactivateMyPushTokens().catch(() => undefined);

        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        if (authMeCacheKey) {
          removeCacheValue(authMeCacheKey).catch(() => {
            // Cache temizleme hatasi ana akisi etkilemesin.
          });
        }
      },
    };
  }, [demoUser, isDarkMode, isLoading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  }
  return context;
}
