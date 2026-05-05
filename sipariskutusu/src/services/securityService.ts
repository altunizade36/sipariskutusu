import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SECURITY_STORAGE_KEY = 'security-settings-v1';
const PASSWORD_HASH_KEY = 'security-password-hash-v1';

type WebCryptoLike = {
  subtle?: {
    digest: (algorithm: string, data: ArrayBuffer) => Promise<ArrayBuffer>;
  };
};

export type SecuritySessionRisk = 'trusted' | 'review';
export type SecurityEventSeverity = 'low' | 'medium' | 'high';

export type SecuritySession = {
  id: string;
  device: string;
  location: string;
  lastSeen: string;
  current: boolean;
  risk: SecuritySessionRisk;
};

export type SecurityEvent = {
  id: string;
  title: string;
  description: string;
  severity: SecurityEventSeverity;
  createdAt: string;
};

export type SecurityState = {
  twoFactor: boolean;
  biometric: boolean;
  loginAlert: boolean;
  passkeyEnabled: boolean;
  newDeviceApproval: boolean;
  autoLogoutMinutes: 15 | 30 | 60 | 120 | 0;
  bruteForceProtection: boolean;
  transactionPinEnabled: boolean;
  locationLock: boolean;
  emailAlert: boolean;
  smsAlert: boolean;
  recoveryEmail: boolean;
  recoverySms: boolean;
  failedAttempts24h: number;
  sessions: SecuritySession[];
  events: SecurityEvent[];
  passwordChangedAt: string | null;
  lastScanAt: string | null;
  transactionPinLastUpdatedAt: string | null;
  securityScore: number;
};

type SecurityStateInput = Omit<SecurityState, 'securityScore'>;

const defaultState: SecurityState = {
  twoFactor: false,
  biometric: true,
  loginAlert: true,
  passkeyEnabled: false,
  newDeviceApproval: true,
  autoLogoutMinutes: 30,
  bruteForceProtection: true,
  transactionPinEnabled: false,
  locationLock: false,
  emailAlert: true,
  smsAlert: false,
  recoveryEmail: true,
  recoverySms: false,
  failedAttempts24h: 2,
  sessions: [
    {
      id: 'session-1',
      device: 'iPhone 15 Pro',
      location: 'Ankara, TR',
      lastSeen: 'Şu an aktif',
      current: true,
      risk: 'trusted',
    },
    {
      id: 'session-2',
      device: 'MacBook Air',
      location: 'Ankara, TR',
      lastSeen: '2 saat önce',
      current: false,
      risk: 'trusted',
    },
    {
      id: 'session-3',
      device: 'Chrome / Windows',
      location: 'İstanbul, TR',
      lastSeen: 'Dün 18:40',
      current: false,
      risk: 'review',
    },
  ],
  events: [
    {
      id: 'evt-1',
      title: 'Başarısız giriş denemesi',
      description: 'Son 24 saatte 2 başarısız giriş denemesi kaydedildi.',
      severity: 'medium',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'evt-2',
      title: 'İncelenmesi gereken oturum',
      description: 'Chrome / Windows oturumunun konumu alışılmış desenin dışında.',
      severity: 'high',
      createdAt: new Date().toISOString(),
    },
  ],
  passwordChangedAt: null,
  lastScanAt: null,
  transactionPinLastUpdatedAt: null,
  securityScore: 0,
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, score));
}

function toStateInput(state: SecurityState): SecurityStateInput {
  const { securityScore, ...rest } = state;
  return rest;
}

function createEvent(
  title: string,
  description: string,
  severity: SecurityEventSeverity,
): SecurityEvent {
  return {
    id: createId('evt'),
    title,
    description,
    severity,
    createdAt: new Date().toISOString(),
  };
}

function calculateSecurityScore(state: SecurityStateInput): number {
  const riskySessions = state.sessions.filter((session) => session.risk === 'review').length;
  let score = 24;

  if (state.twoFactor) score += 12;
  if (state.biometric) score += 8;
  if (state.loginAlert) score += 6;
  if (state.passkeyEnabled) score += 10;
  if (state.newDeviceApproval) score += 7;
  if (state.autoLogoutMinutes > 0 && state.autoLogoutMinutes <= 30) score += 7;
  if (state.bruteForceProtection) score += 8;
  if (state.transactionPinEnabled) score += 8;
  if (state.locationLock) score += 6;
  if (state.emailAlert) score += 4;
  if (state.smsAlert) score += 4;
  if (state.recoveryEmail) score += 3;
  if (state.recoverySms) score += 3;
  if (state.passwordChangedAt) score += 4;

  score -= Math.min(state.failedAttempts24h * 3, 18);
  score -= riskySessions * 10;

  return clampScore(score);
}

function withScore(state: SecurityStateInput): SecurityState {
  return {
    ...state,
    securityScore: calculateSecurityScore(state),
  };
}

function mergeState(value: Partial<SecurityState> | null | undefined): SecurityState {
  const merged = {
    ...defaultState,
    ...value,
    sessions: value?.sessions ?? defaultState.sessions,
    events: value?.events ?? defaultState.events,
  };

  return withScore(toStateInput(merged));
}

async function saveState(state: SecurityState) {
  await AsyncStorage.setItem(SECURITY_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export async function loadSecurityState() {
  const rawValue = await AsyncStorage.getItem(SECURITY_STORAGE_KEY);
  if (!rawValue) {
    const seededState = withScore(toStateInput(defaultState));
    await saveState(seededState);
    return seededState;
  }

  const parsed = JSON.parse(rawValue) as Partial<SecurityState>;
  const merged = mergeState(parsed);
  await saveState(merged);
  return merged;
}

export async function persistSecurityState(state: SecurityState) {
  return saveState(withScore(toStateInput(state)));
}

export async function updateSecurityState(
  updater: (current: SecurityState) => SecurityState,
) {
  const current = await loadSecurityState();
  const next = updater(current);
  return persistSecurityState(next);
}

async function hashValue(value: string) {
  try {
    if (Platform.OS !== 'web') {
      const Crypto = await import('expo-crypto');
      return await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        value,
        { encoding: Crypto.CryptoEncoding.HEX },
      );
    }

    throw new Error('Web digest fallback');
  } catch {
    const webCrypto = (globalThis as { crypto?: WebCryptoLike }).crypto;
    if (!webCrypto?.subtle) {
      throw new Error('Güvenli hash oluşturulamadı.');
    }

    const encoded = new TextEncoder().encode(value);
    const digest = await webCrypto.subtle.digest('SHA-256', encoded.buffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const storedHash = await SecureStore.getItemAsync(PASSWORD_HASH_KEY);

  if (storedHash) {
    const currentHash = await hashValue(currentPassword);
    if (currentHash !== storedHash) {
      throw new Error('Mevcut şifre doğrulanamadı.');
    }
  }

  const nextHash = await hashValue(newPassword);
  await SecureStore.setItemAsync(PASSWORD_HASH_KEY, nextHash);

  return updateSecurityState((current) => ({
    ...current,
    passwordChangedAt: new Date().toISOString(),
    events: [
      createEvent('Şifre güncellendi', 'Hesabın giriş şifresi başarıyla değiştirildi.', 'low'),
      ...current.events,
    ].slice(0, 8),
  }));
}

export async function setTransactionPin(enabled: boolean) {
  return updateSecurityState((current) => ({
    ...current,
    transactionPinEnabled: enabled,
    transactionPinLastUpdatedAt: enabled ? new Date().toISOString() : current.transactionPinLastUpdatedAt,
    events: [
      createEvent(
        enabled ? 'İşlem PINi etkinleştirildi' : 'İşlem PINi kapatıldı',
        enabled
          ? 'Ödeme onaylarında işlem PINi kullanılacak.'
          : 'Ödeme onaylarında işlem PINi artık istenmeyecek.',
        enabled ? 'medium' : 'low',
      ),
      ...current.events,
    ].slice(0, 8),
  }));
}

export async function closeSession(sessionId: string) {
  return updateSecurityState((current) => ({
    ...current,
    sessions: current.sessions.filter((session) => session.id !== sessionId),
    events: [
      createEvent('Oturum kapatıldı', 'Seçilen cihazın erişimi sonlandırıldı.', 'low'),
      ...current.events,
    ].slice(0, 8),
  }));
}

export async function closeOtherSessions() {
  return updateSecurityState((current) => ({
    ...current,
    sessions: current.sessions.filter((session) => session.current),
    events: [
      createEvent('Diğer oturumlar kapatıldı', 'Mevcut cihaz dışındaki tüm oturumlar sonlandırıldı.', 'medium'),
      ...current.events,
    ].slice(0, 8),
  }));
}

export async function applyRecommendedSecurity() {
  return updateSecurityState((current) => ({
    ...current,
    twoFactor: true,
    passkeyEnabled: true,
    newDeviceApproval: true,
    autoLogoutMinutes: 15,
    bruteForceProtection: true,
    transactionPinEnabled: true,
    locationLock: true,
    emailAlert: true,
    smsAlert: true,
    recoveryEmail: true,
    recoverySms: true,
    lastScanAt: new Date().toISOString(),
    events: [
      createEvent('Önerilen güvenlikler uygulandı', 'Yüksek önem dereceli ayarlar otomatik olarak etkinleştirildi.', 'medium'),
      ...current.events,
    ].slice(0, 8),
  }));
}

export async function runSecurityScan() {
  return updateSecurityState((current) => {
    const riskySessions = current.sessions.filter((session) => session.risk === 'review').length;
    const nextEvents = [...current.events];

    if (riskySessions > 0) {
      nextEvents.unshift(
        createEvent('Tarama riskli oturum buldu', `${riskySessions} oturum incelenmesi gereken risk düzeyinde işaretlendi.`, 'high'),
      );
    }

    if (!current.twoFactor || !current.passkeyEnabled || !current.locationLock) {
      nextEvents.unshift(
        createEvent('Eksik güvenlik ayarı bulundu', 'Tarama, etkinleştirilmesi gereken koruma ayarları tespit etti.', 'medium'),
      );
    }

    return {
      ...current,
      lastScanAt: new Date().toISOString(),
      events: nextEvents.slice(0, 8),
    };
  });
}

export function getSecurityStatusLabel(score: number) {
  if (score >= 85) return 'Çok iyi';
  if (score >= 70) return 'İyi';
  if (score >= 50) return 'Orta';
  return 'Zayıf';
}

export function getRiskySessionCount(state: SecurityState) {
  return state.sessions.filter((session) => session.risk === 'review').length;
}

export function getPasswordAgeInDays(passwordChangedAt: string | null) {
  if (!passwordChangedAt) {
    return null;
  }

  const diffMs = Date.now() - new Date(passwordChangedAt).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}
