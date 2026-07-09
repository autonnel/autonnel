

// Once published, KV keys MUST NOT be renamed — SaaS tenants may have written
// rows against them. Add new keys, never repurpose old ones.
import { getConfig, setConfig } from './get-config';
import { readEnv } from '@/lib/runtime/env';
import { DEFAULT_TIMEZONE } from '@/lib/constants/timezone';
import type { NotificationPairing } from '@/lib/notifications/routing-types';

export interface LastConversionAnalysisResult {
  runAt: string;
  timeRange: string;
  sessionsAnalyzed: number;
  summary: string;
  analysis: string;
  hasLlmInsights: boolean;
}

export interface BrandingLogo { url: string; alt?: string }
export interface BrandingFavicon { url: string }

export interface MaintenanceConfig {
  enabled: boolean;
  passwordHash?: string;
  message?: string;
}

export interface ConfigKey<T = unknown> {

  key: string;

  envFallback: string;

  __t?: T;
}

function k<T>(key: string, envFallback: string): ConfigKey<T> {
  return { key, envFallback };
}

export const ConfigKeys = {
  OAUTH_CLIENT_ID:        k<string>('oauth.client_id',        'OAUTH_CLIENT_ID'),
  OAUTH_CLIENT_SECRET:    k<string>('oauth.client_secret',    'OAUTH_CLIENT_SECRET'),
  OAUTH_AUTHORIZATION_URL: k<string>('oauth.authorization_url', 'OAUTH_AUTHORIZATION_URL'),
  OAUTH_TOKEN_URL:        k<string>('oauth.token_url',        'OAUTH_TOKEN_URL'),
  OAUTH_USER_INFO_URL:    k<string>('oauth.user_info_url',    'OAUTH_USER_INFO_URL'),
  OAUTH_REDIRECT_URI:     k<string>('oauth.redirect_uri',     'OAUTH_REDIRECT_URI'),
  OAUTH_SCOPES:           k<string>('oauth.scopes',           'OAUTH_SCOPES'),

  GOOGLE_MAPS_API_KEY:    k<string>('google_maps.api_key',    'GOOGLE_MAPS_API_KEY'),

  DEFAULT_CDN_URL:        k<string>('cdn.default_url',        'DEFAULT_CDN_URL'),

  MARKETPLACE_BASE_URL:   k<string>('marketplace.base_url',   'MARKETPLACE_BASE_URL'),

  PERMISSIONS_ADMIN_USER_IDS: k<string>('permissions.admin_user_ids', 'PERMISSIONS_ADMIN_USER_IDS'),

  MQ_DEFAULT_TOPIC:       k<string>('mq.default_topic',       'MQ_DEFAULT_TOPIC'),

  LOCALIZATION_TIMEZONE:  k<string>('localization.timezone',        'LOCALIZATION_TIMEZONE'),

  SETUP_COMPLETED:        k<boolean>('setup.completed',             'SETUP_COMPLETED'),

  BRANDING_NAME:          k<string>('branding.name',                'BRANDING_NAME'),
  BRANDING_LOGO:          k<BrandingLogo>('branding.logo',          'BRANDING_LOGO'),
  BRANDING_FAVICON:       k<BrandingFavicon>('branding.favicon',    'BRANDING_FAVICON'),
  MAINTENANCE_CONFIG:     k<MaintenanceConfig>('maintenance.config','MAINTENANCE_CONFIG'),

  NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT:           k<string>('notifications.conversion_analysis.prompt',            'NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT'),
  NOTIFICATIONS_CONVERSION_ANALYSIS_FREQUENCY_MINUTES: k<number>('notifications.conversion_analysis.frequency_minutes', 'NOTIFICATIONS_CONVERSION_ANALYSIS_FREQUENCY_MINUTES'),
  NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RUN_AT:      k<string>('notifications.conversion_analysis.last_run_at',       'NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RUN_AT'),
  NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RESULT:      k<LastConversionAnalysisResult>('notifications.conversion_analysis.last_result', 'NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RESULT'),
  NOTIFICATIONS_EMAIL_ENABLED:                        k<boolean>('notifications.email.enabled',                       'NOTIFICATIONS_EMAIL_ENABLED'),
  NOTIFICATIONS_EMAIL_RECIPIENTS:                     k<string[]>('notifications.email.recipients',                   'NOTIFICATIONS_EMAIL_RECIPIENTS'),
  NOTIFICATIONS_SLACK_ENABLED:                        k<boolean>('notifications.slack.enabled',                       'NOTIFICATIONS_SLACK_ENABLED'),
  NOTIFICATIONS_SLACK_WEBHOOK_URL:                    k<string>('notifications.slack.webhook_url',                    'NOTIFICATIONS_SLACK_WEBHOOK_URL'),
  NOTIFICATIONS_WEBHOOK_ENABLED:                      k<boolean>('notifications.webhook.enabled',                     'NOTIFICATIONS_WEBHOOK_ENABLED'),
  NOTIFICATIONS_WEBHOOK_URL:                          k<string>('notifications.webhook.url',                          'NOTIFICATIONS_WEBHOOK_URL'),
  NOTIFICATIONS_WEBHOOK_SECRET:                       k<string>('notifications.webhook.secret',                       'NOTIFICATIONS_WEBHOOK_SECRET'),
  NOTIFICATIONS_ROUTES:                                k<NotificationPairing[]>('notifications.routes',                  'NOTIFICATIONS_ROUTES'),

  CF_BROWSER_RENDERING_ACCOUNT_ID: k<string>('cf.browser_rendering.account_id', 'CF_BROWSER_RENDERING_ACCOUNT_ID'),
  CF_BROWSER_RENDERING_API_TOKEN:  k<string>('cf.browser_rendering.api_token',  'CF_BROWSER_RENDERING_API_TOKEN'),
} as const;

export type ConfigKeyName = keyof typeof ConfigKeys;


export async function readConfigKey<T = string>(spec: ConfigKey<T>): Promise<T | undefined> {
  // envFallback is the NAME of an env var to read when the key is absent from the
  // config store — not a literal value. (Reading the name as the value made every
  // missing key resolve to the env-var-name string.)
  const fromEnv = spec.envFallback ? readEnv(spec.envFallback) : undefined;
  return getConfig<T>(spec.key, fromEnv as T | undefined);
}


export const getOAuthClientId        = () => readConfigKey<string>(ConfigKeys.OAUTH_CLIENT_ID);
export const getOAuthClientSecret    = () => readConfigKey<string>(ConfigKeys.OAUTH_CLIENT_SECRET);
export const getOAuthAuthorizationUrl = () => readConfigKey<string>(ConfigKeys.OAUTH_AUTHORIZATION_URL);
export const getOAuthTokenUrl        = () => readConfigKey<string>(ConfigKeys.OAUTH_TOKEN_URL);
export const getOAuthUserInfoUrl     = () => readConfigKey<string>(ConfigKeys.OAUTH_USER_INFO_URL);
export const getOAuthRedirectUri     = () => readConfigKey<string>(ConfigKeys.OAUTH_REDIRECT_URI);
export const getOAuthScopes          = () => readConfigKey<string>(ConfigKeys.OAUTH_SCOPES);

export const getGoogleMapsApiKey     = () => readConfigKey<string>(ConfigKeys.GOOGLE_MAPS_API_KEY);

// Site-wide default timezone (Etc/GMT-* fixed offsets). Resolves to DEFAULT_TIMEZONE when unset so
// every caller can treat the result as a guaranteed string.
export const getSiteTimezone = async (): Promise<string> =>
  (await readConfigKey<string>(ConfigKeys.LOCALIZATION_TIMEZONE)) || DEFAULT_TIMEZONE;
export const setSiteTimezone = (v: string) => setConfig(ConfigKeys.LOCALIZATION_TIMEZONE.key, v);

export const getDefaultCdnUrl        = () => readConfigKey<string>(ConfigKeys.DEFAULT_CDN_URL);

const DEFAULT_MARKETPLACE_BASE_URL = 'https://autonnel.com';
export const getMarketplaceBaseUrl = async () =>
  (await readConfigKey<string>(ConfigKeys.MARKETPLACE_BASE_URL)) || DEFAULT_MARKETPLACE_BASE_URL;

export const getPermissionsAdminIdsRaw = () => readConfigKey<string>(ConfigKeys.PERMISSIONS_ADMIN_USER_IDS);

export const getMqDefaultTopic       = () => readConfigKey<string>(ConfigKeys.MQ_DEFAULT_TOPIC);


export const getConversionAnalysisPrompt           = () => readConfigKey<string>(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_PROMPT);
export const getConversionAnalysisFrequencyMinutes = () => readConfigKey<number>(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_FREQUENCY_MINUTES);
export const getConversionAnalysisLastRunAt        = () => readConfigKey<string>(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RUN_AT);
export const getLastConversionAnalysisResult      = () => readConfigKey<LastConversionAnalysisResult>(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RESULT);
export const setLastConversionAnalysisResult      = (value: LastConversionAnalysisResult) =>
  setConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RESULT.key, value as any);
export const setConversionAnalysisLastRunAt        = (d: Date) =>
  setConfig(ConfigKeys.NOTIFICATIONS_CONVERSION_ANALYSIS_LAST_RUN_AT.key, d.toISOString());


export const getNotificationsEmailEnabled    = () => readConfigKey<boolean>(ConfigKeys.NOTIFICATIONS_EMAIL_ENABLED);
export const getNotificationsEmailRecipients = () => readConfigKey<string[]>(ConfigKeys.NOTIFICATIONS_EMAIL_RECIPIENTS);
export const getNotificationsSlackEnabled    = () => readConfigKey<boolean>(ConfigKeys.NOTIFICATIONS_SLACK_ENABLED);
export const getNotificationsSlackWebhookUrl = () => readConfigKey<string>(ConfigKeys.NOTIFICATIONS_SLACK_WEBHOOK_URL);
export const getNotificationsWebhookEnabled  = () => readConfigKey<boolean>(ConfigKeys.NOTIFICATIONS_WEBHOOK_ENABLED);
export const getNotificationsWebhookUrl      = () => readConfigKey<string>(ConfigKeys.NOTIFICATIONS_WEBHOOK_URL);
export const getNotificationsWebhookSecret   = () => readConfigKey<string>(ConfigKeys.NOTIFICATIONS_WEBHOOK_SECRET);


export const getNotificationsRoutes = () =>
  readConfigKey<NotificationPairing[]>(ConfigKeys.NOTIFICATIONS_ROUTES);
export const setNotificationsRoutes = (value: NotificationPairing[]) =>
  setConfig(ConfigKeys.NOTIFICATIONS_ROUTES.key, value);

// Raw value (may be an env-fallback string); normalize via deriveSetupState in lib/auth/setup-state.
export const getSetupCompletedRaw = () => readConfigKey<boolean | string>(ConfigKeys.SETUP_COMPLETED);
export const setSetupCompleted    = (v: boolean) => setConfig(ConfigKeys.SETUP_COMPLETED.key, v);

export const getBrandingName     = () => readConfigKey<string>(ConfigKeys.BRANDING_NAME);
export const setBrandingName     = (v: string) => setConfig(ConfigKeys.BRANDING_NAME.key, v);
export const getBrandingLogo     = () => readConfigKey<BrandingLogo>(ConfigKeys.BRANDING_LOGO);
export const setBrandingLogo     = (v: BrandingLogo) => setConfig(ConfigKeys.BRANDING_LOGO.key, v);
export const getBrandingFavicon  = () => readConfigKey<BrandingFavicon>(ConfigKeys.BRANDING_FAVICON);
export const setBrandingFavicon  = (v: BrandingFavicon) => setConfig(ConfigKeys.BRANDING_FAVICON.key, v);
export const getMaintenanceConfig = () => readConfigKey<MaintenanceConfig>(ConfigKeys.MAINTENANCE_CONFIG);
export const setMaintenanceConfig = (v: MaintenanceConfig) => setConfig(ConfigKeys.MAINTENANCE_CONFIG.key, v);

export const getCfBrowserRenderingAccountId = () =>
  readConfigKey<string>(ConfigKeys.CF_BROWSER_RENDERING_ACCOUNT_ID);
export const getCfBrowserRenderingApiToken = () =>
  readConfigKey<string>(ConfigKeys.CF_BROWSER_RENDERING_API_TOKEN);
