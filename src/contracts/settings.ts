import type { FaviconJson, LogoJson } from '@/lib/branding/types';
import type { LlmModel, LlmModelType } from '@/lib/config/llm-models-types';
import type { RecallStatsRange } from '@/lib/services/recall-stats.service';

export interface BrandingDto {
  name: string | null;
  favicon: { url: string } | null;
  logo: { url: string } | null;
}

// apiKey is masked; never plaintext over the wire.
export type LlmModelMasked = LlmModel;

export interface LlmModelInput {
  type: LlmModelType;
  provider: string;
  name: string;
  modelId: string;
  baseUrl: string;
  /** Empty string keeps the existing stored key. */
  apiKey: string;
  options?: Record<string, unknown>;
  isDefault?: boolean;
}

export interface LlmTestInput extends LlmModelInput {}

export interface LlmTestResult {
  ok: boolean;
  error?: string;
}

export interface EmailConfigWire {
  id: string;
  provider: 'SMTP' | 'RESEND';
  name: string;
  fromEmail: string;
  fromName: string | null;
  replyTo: string | null;
  isActive: boolean;
  maskedCredentials?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface EmailConfigPutInput {
  provider?: 'SMTP' | 'RESEND';
  credentials?: Record<string, unknown>;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string;
  isActive?: boolean;
}

export interface RecallInterval {
  hours: number;
  emailTemplateType: string;
  couponId?: string | null;
}

export interface RecallConfigWire {
  id: string | null;
  isEnabled: boolean;
  intervals: RecallInterval[];
  isGlobalDefault?: boolean;
}

export interface RecallPutInput {
  isEnabled: boolean;
  intervals: RecallInterval[];
}

export interface RecallPutResult {
  id: string | null;
  isEnabled: boolean;
  intervals: RecallInterval[];
}

export interface RecallStatsWire {
  range: RecallStatsRange;
  emailsSent: number;
  ordersRecovered: number;
  recoveryRate: number | null;
}

export interface LocalizationWire {
  timezone: string;
}

export interface LocalizationPutInput {
  timezone: string;
}

export interface GoogleMapsWire {
  apiKeyMasked: string;
  hasConfig: boolean;
}

export interface GoogleMapsPutInput {
  apiKey: string | null;
}

export interface BrowserRenderingWire {
  accountId: string;
  apiTokenMasked: string;
  hasToken: boolean;
}

export interface BrowserRenderingPutInput {
  accountId?: string | null;
  apiToken?: string | null;
}

export interface BrowserRenderingTestInput {
  accountId?: string;
  apiToken?: string;
}

export interface BrowserRenderingTestResult {
  ok: boolean;
  htmlSize?: number;
  error?: string;
}

export interface MaintenanceWire {
  enabled: boolean;
  message: string;
  hasPassword: boolean;
  canEdit: boolean;
}

export interface MaintenancePatchInput {
  enabled?: boolean;
  message?: string | null;
  password?: string;
  clearPassword?: boolean;
}

export interface MaintenancePatchResult {
  enabled: boolean;
  message: string;
  hasPassword: boolean;
  canEdit: boolean;
}

export interface AiConversionAnalysisLastResult {
  runAt: string;
  timeRange: string;
  sessionsAnalyzed: number;
  summary: string;
  analysis: string;
  hasLlmInsights: boolean;
}

export interface AiConversionAnalysisWire {
  prompt: string;
  frequencyMinutes: number;
  lastResult: AiConversionAnalysisLastResult | null;
}

export interface AiConversionAnalysisPutInput {
  prompt?: string | null;
  frequencyMinutes?: number;
}

export type MaskedChannel =
  | { type: 'email'; recipients: string[] }
  | { type: 'slack'; webhookUrl: string; webhookUrlHasStored: boolean }
  | { type: 'webhook'; url: string; urlHasStored: boolean; secret: string; secretHasStored: boolean };

export interface MaskedPairingWire {
  id: string;
  name: string;
  enabled: boolean;
  events: string[];
  channel: MaskedChannel;
}

export interface NotificationPairingInput {
  id?: string;
  name?: string;
  enabled?: boolean;
  events?: string[];
  channel: unknown;
}

export interface NotificationsWire {
  pairings: MaskedPairingWire[];
}

export interface NotificationsPutInput {
  pairings: NotificationPairingInput[];
}

export interface NotificationTestInput {
  pairing: NotificationPairingInput;
}

export interface NotificationTestResult {
  ok: boolean;
  error?: string;
}

export interface NotificationLogWire {
  id: string;
  channel: string;
  purpose: string;
  recipient: string;
  subject: string | null;
  content: string;
  status: string;
  error: string | null;
  createdAt: string;
}

export interface NotificationLogsWire {
  items: NotificationLogWire[];
  total: number;
  page: number;
  pageSize: number;
}

export interface StorageConfigWire {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
  staticDomain?: string | null;
  test?: { uploadedKey: string; fetched: boolean; url: string | null };
}

export interface StoragePutInput {
  endpoint?: string;
  region?: string;
  bucket?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  keyPrefix?: string;
  staticDomain?: string | null;
}

export interface StorageStatusWire {
  configured: boolean;
}

export interface PaymentConfigWire {
  id: string;
  provider: string;
  name: string;
  credentials?: Record<string, unknown>;
  settings?: Record<string, unknown> | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentPutInput {
  name?: string;
  credentials: Record<string, unknown>;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

export type EcommerceProvider = 'SHOPIFY' | 'WOOCOMMERCE' | 'PICOCART';
export type FulfillmentMode = 'merged' | 'split';

export interface EcommerceConfigWire {
  provider: EcommerceProvider;
  isActive: boolean;
  fulfillmentMode: FulfillmentMode;
  maskedCredentials: Record<string, unknown>;
}

export interface EcommercePutInput {
  provider: EcommerceProvider;
  credentials: Record<string, unknown>;
  isActive?: boolean;
  fulfillmentMode?: FulfillmentMode;
}

export interface EmailTemplateUpsertInput {
  templateType: string;
  name: string;
  subject: string;
  content: string;
  design?: unknown;
  isActive?: boolean;
  language?: string;
}

export interface EmailTemplateUpsertResult {
  ok: true;
  templateType: string;
  versionId: string;
}

export interface SettingsContracts {
  'GET /api/settings/branding': { input: null; output: BrandingDto };
  'PUT /api/settings/branding': {
    input: { name?: string; favicon?: { url: string } | null; logo?: { url: string } | null };
    output: BrandingDto;
  };

  'GET /api/settings/llm': { input: null; output: { models: LlmModelMasked[] } };
  'POST /api/settings/llm': { input: LlmModelInput; output: { models: LlmModelMasked[] } };
  // type + name supplied via ?type=&name= query params (apiCall omits DELETE bodies).
  'DELETE /api/settings/llm': { input: null; output: { models: LlmModelMasked[] } };
  'POST /api/settings/llm/test': { input: LlmTestInput; output: LlmTestResult };

  'GET /api/settings/email': { input: null; output: EmailConfigWire | null };
  'PUT /api/settings/email': { input: EmailConfigPutInput; output: EmailConfigWire };
  'DELETE /api/settings/email': { input: null; output: { success: true } };

  'GET /api/settings/recall': { input: null; output: RecallConfigWire };
  'PUT /api/settings/recall': { input: RecallPutInput; output: RecallPutResult };
  'GET /api/settings/recall/stats': { input: null; output: RecallStatsWire };

  'GET /api/settings/localization': { input: null; output: LocalizationWire };
  'PUT /api/settings/localization': { input: LocalizationPutInput; output: LocalizationWire };

  'GET /api/settings/google-maps': { input: null; output: GoogleMapsWire };
  'PUT /api/settings/google-maps': { input: GoogleMapsPutInput; output: GoogleMapsWire };

  'GET /api/settings/browser-rendering': { input: null; output: BrowserRenderingWire };
  'PUT /api/settings/browser-rendering': { input: BrowserRenderingPutInput; output: BrowserRenderingWire };
  'POST /api/settings/browser-rendering/test': {
    input: BrowserRenderingTestInput;
    output: BrowserRenderingTestResult;
  };

  // maintenance (GET stays a raw withAuth APIRoute; only PATCH is panel-wired)
  'PATCH /api/settings/maintenance': { input: MaintenancePatchInput; output: MaintenancePatchResult };

  'GET /api/settings/ai-conversion-analysis': { input: null; output: AiConversionAnalysisWire };
  'PUT /api/settings/ai-conversion-analysis': {
    input: AiConversionAnalysisPutInput;
    output: { ok: true };
  };
  'DELETE /api/settings/ai-conversion-analysis': { input: null; output: { success: true } };

  'GET /api/settings/notifications': { input: null; output: NotificationsWire };
  'PUT /api/settings/notifications': { input: NotificationsPutInput; output: NotificationsWire };
  'POST /api/settings/notifications/test': { input: NotificationTestInput; output: NotificationTestResult };
  'GET /api/settings/notifications/logs': { input: null; output: NotificationLogsWire };

  'GET /api/settings/storage': { input: null; output: StorageConfigWire | null };
  'PUT /api/settings/storage': { input: StoragePutInput; output: StorageConfigWire };
  'DELETE /api/settings/storage': { input: null; output: { success: true } };
  'GET /api/settings/storage/status': { input: null; output: StorageStatusWire };

  'GET /api/settings/payment/:provider': { input: null; output: PaymentConfigWire | null };
  'PUT /api/settings/payment/:provider': { input: PaymentPutInput; output: PaymentConfigWire };
  'DELETE /api/settings/payment/:provider': { input: null; output: { success: true } };

  'GET /api/ecommerce/config': { input: null; output: EcommerceConfigWire | null };
  'PUT /api/ecommerce/config': { input: EcommercePutInput; output: EcommerceConfigWire };
  'DELETE /api/ecommerce/config': { input: null; output: { success: true } };
  'POST /api/ecommerce/resync': { input: null; output: { synced: number } };

  'POST /api/settings/email-templates': {
    input: EmailTemplateUpsertInput;
    output: EmailTemplateUpsertResult;
  };
}
