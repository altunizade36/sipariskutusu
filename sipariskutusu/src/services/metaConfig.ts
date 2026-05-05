const DEFAULT_GRAPH_API_VERSION = 'v21.0';
const DEFAULT_INSTAGRAM_LOGIN_SCOPES = [
  'instagram_business_basic',
];
const DEFAULT_FACEBOOK_LOGIN_SCOPES = [
  'instagram_basic',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

export type MetaIntegrationConfig = {
  appId: string | null;
  instagramAppId: string | null;
  redirectUri: string | null;
  appReturnUri: string | null;
  graphApiVersion: string;
  scopes: string[];
  authProvider: 'instagram' | 'facebook';
  isConfigured: boolean;
};

function splitScopes(value?: string) {
  return (value ?? '')
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getMetaIntegrationConfig(): MetaIntegrationConfig {
  const appId = process.env.EXPO_PUBLIC_META_APP_ID?.trim() || null;
  const instagramAppId = process.env.EXPO_PUBLIC_INSTAGRAM_APP_ID?.trim() || null;
  const redirectUri = process.env.EXPO_PUBLIC_META_REDIRECT_URI?.trim() || null;
  const appReturnUri = process.env.EXPO_PUBLIC_META_APP_RETURN_URI?.trim() || 'sipariskutusu://instagram-auth';
  const graphApiVersion = process.env.EXPO_PUBLIC_META_GRAPH_API_VERSION?.trim() || DEFAULT_GRAPH_API_VERSION;
  const authProvider =
    process.env.EXPO_PUBLIC_META_AUTH_PROVIDER?.trim().toLowerCase() === 'facebook'
      ? 'facebook'
      : 'instagram';
  const scopes = splitScopes(process.env.EXPO_PUBLIC_INSTAGRAM_OAUTH_SCOPES);
  const oauthAppId = authProvider === 'instagram' ? instagramAppId : appId;
  const defaultScopes =
    authProvider === 'instagram'
      ? DEFAULT_INSTAGRAM_LOGIN_SCOPES
      : DEFAULT_FACEBOOK_LOGIN_SCOPES;

  return {
    appId,
    instagramAppId,
    redirectUri,
    appReturnUri,
    graphApiVersion,
    scopes: scopes.length > 0 ? scopes : defaultScopes,
    authProvider,
    isConfigured: Boolean(oauthAppId && redirectUri && appReturnUri),
  };
}
