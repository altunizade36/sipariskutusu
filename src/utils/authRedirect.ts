const APP_SCHEME = 'sipariskutusu';

export function buildAuthRedirectUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '');
  return `${APP_SCHEME}://${normalizedPath}`;
}

export const AUTH_REDIRECT_URL = buildAuthRedirectUrl('auth');
export const PASSWORD_RESET_REDIRECT_URL = buildAuthRedirectUrl('reset-password');