import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const linkingMocks = vi.hoisted(() => ({
  remove: vi.fn(),
  getInitialURL: vi.fn(async () => null),
  addEventListener: vi.fn(() => ({ remove: linkingMocks.remove })),
  createURL: vi.fn((path) => `sipariskutusu://${path}`),
}));

const mockUnsubscribe = vi.fn();
const mockSetSentryUser = vi.fn();
const mockIdentifyUser = vi.fn();
const mockResetUser = vi.fn();

let mockIsConfigured = true;
let mockSession = null;

const mockAuth = {
  getSession: vi.fn(async () => ({ data: { session: mockSession } })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: mockUnsubscribe } } })),
  signInWithPassword: vi.fn(async () => ({ error: null })),
  signUp: vi.fn(async () => ({ error: null })),
  signInWithOtp: vi.fn(async () => ({ error: null })),
  verifyOtp: vi.fn(async () => ({ error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  updateUser: vi.fn(async () => ({ error: null })),
  getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  setSession: vi.fn(async () => ({ error: null })),
  exchangeCodeForSession: vi.fn(async () => ({ error: null })),
};

vi.mock('expo-linking', () => ({
  getInitialURL: linkingMocks.getInitialURL,
  addEventListener: linkingMocks.addEventListener,
  createURL: linkingMocks.createURL,
}));

vi.mock('../services/monitoring', () => ({
  setSentryUser: (...args) => mockSetSentryUser(...args),
  identifyUser: (...args) => mockIdentifyUser(...args),
  resetUser: () => mockResetUser(),
}));

vi.mock('../services/supabase', () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured;
  },
  getSupabaseClient: () => ({ auth: mockAuth }),
}));

let capturedAuth = null;

function Harness() {
  capturedAuth = useAuth();
  return null;
}

async function renderAuthProvider() {
  capturedAuth = null;

  await act(async () => {
    TestRenderer.create(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
  });

  if (!capturedAuth) {
    throw new Error('Auth context was not captured.');
  }

  return capturedAuth;
}

describe('AuthProvider auth flows', () => {
  beforeEach(() => {
    mockIsConfigured = true;
    mockSession = null;
    linkingMocks.remove.mockReset();
    mockUnsubscribe.mockReset();
    mockSetSentryUser.mockReset();
    mockIdentifyUser.mockReset();
    mockResetUser.mockReset();

    for (const fn of Object.values(mockAuth)) {
      fn.mockClear();
    }

    mockAuth.getSession.mockResolvedValue({ data: { session: mockSession } });
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    mockAuth.signInWithPassword.mockResolvedValue({ error: null });
    mockAuth.signUp.mockResolvedValue({ error: null });
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ error: null });
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    mockAuth.signOut.mockResolvedValue({ error: null });
    mockAuth.setSession.mockResolvedValue({ error: null });
    mockAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
  });

  it('uses demo login without calling Supabase when demo credentials match', async () => {
    mockIsConfigured = false;
    const auth = await renderAuthProvider();

    await act(async () => {
      await auth.signInWithPassword('  alici@sipariskutusu.demo ', 'Demo123!');
    });

    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    expect(capturedAuth?.user?.email).toBe('alici@sipariskutusu.demo');
    expect(capturedAuth?.isUserVerified).toBe(true);
  });

  it('forwards trimmed email and password to Supabase login', async () => {
    const auth = await renderAuthProvider();

    await act(async () => {
      await auth.signInWithPassword('  User@Example.com ', 'Secret123!');
    });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'User@Example.com',
      password: 'Secret123!',
    });
  });

  it('forwards register payload with redirect url and full_name metadata', async () => {
    const auth = await renderAuthProvider();

    await act(async () => {
      await auth.signUpWithPassword('  yeni@example.com ', 'Secret123!', '  Yeni Kullanici ');
    });

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'yeni@example.com',
      password: 'Secret123!',
      options: {
        emailRedirectTo: 'sipariskutusu://auth',
        data: { full_name: 'Yeni Kullanici' },
      },
    });
  });

  it('forwards otp, verification and reset-password requests to Supabase', async () => {
    const auth = await renderAuthProvider();

    await act(async () => {
      await auth.sendEmailOtp(' otp@example.com ', false);
      await auth.verifyEmailOtp(' otp@example.com ', ' 12345678 ');
      await auth.resetPassword(' otp@example.com ');
    });

    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({
      email: 'otp@example.com',
      options: {
        shouldCreateUser: false,
        emailRedirectTo: 'sipariskutusu://auth',
      },
    });
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
      email: 'otp@example.com',
      token: '12345678',
      type: 'email',
    });
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('otp@example.com', {
      redirectTo: 'sipariskutusu://reset-password',
    });
  });
});
