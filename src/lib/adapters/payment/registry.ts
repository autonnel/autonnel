export interface PaymentEventTypes {
  clickEvents: string[];
  successEvents: string[];
  errorEvent: string;
}

export interface PaymentDisplayInfo {
  label: string;
  badgeClass: string;
}

export interface PaymentDetailInfo {
  label: string;
  badgeClass: string;
}

export interface StatsColumnDef {
  key: string;
  label: string;
  title: string;
  eventType: string;
  category: 'click' | 'success' | 'error';
}

export interface PaymentFormFieldSpec {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  // Never echoed back to the browser (password fields are always treated as secret).
  secret?: boolean;
  placeholder?: string;
  hint?: string;
}

export type DbPaymentProvider = string;

export interface PaymentProviderRegistration {
  paymentMethod: string;
  dbProvider: DbPaymentProvider;
  eventTypes: PaymentEventTypes;
  display: PaymentDisplayInfo;
  displayName: string;
  formFields: PaymentFormFieldSpec[];
  details: Record<string, PaymentDetailInfo>;
  statsColumns: StatsColumnDef[];
  getPublicConfig?: (credentials: Record<string, any>, settings: Record<string, any>) => Record<string, any> | null;
}

const FALLBACK_SUCCESS = 'PAYMENT_SUCCESS';
const FALLBACK_ERROR = 'PAYMENT_ERROR';
const FALLBACK_DISPLAY: PaymentDisplayInfo = {
  label: '',
  badgeClass: 'bg-gray-100 text-gray-800 border-transparent',
};
const FALLBACK_DETAIL: PaymentDetailInfo = {
  label: '',
  badgeClass: 'bg-gray-50 text-gray-600 border-transparent',
};

interface RegistryStore {
  byMethod: Map<string, PaymentProviderRegistration>;
  byDbProvider: Map<string, PaymentProviderRegistration>;
}

const STORE_KEY = Symbol.for('autonnel.payment.registry');

// Shared through globalThis: plugin registrations arrive via the core dist module while pages may
// import this file from source, and both must see one registry.
function getStore(): RegistryStore {
  const g = globalThis as unknown as { [k: symbol]: RegistryStore | undefined };
  return (g[STORE_KEY] ??= { byMethod: new Map(), byDbProvider: new Map() });
}

function entries(): PaymentProviderRegistration[] {
  return [...getStore().byMethod.values()];
}

function flatMapEntries<T>(pick: (r: PaymentProviderRegistration) => T[]): T[] {
  return entries().reduce<T[]>((acc, reg) => {
    acc.push(...pick(reg));
    return acc;
  }, []);
}

export function registerPaymentProvider(registration: PaymentProviderRegistration): void {
  const { paymentMethod, dbProvider } = registration;
  getStore().byMethod.set(paymentMethod, registration);
  getStore().byDbProvider.set(dbProvider, registration);
}

export function getProviderByMethod(paymentMethod: string): PaymentProviderRegistration | undefined {
  return getStore().byMethod.get(paymentMethod.toLowerCase());
}

export function getProviderByDbKey(dbProvider: string): PaymentProviderRegistration | undefined {
  return getStore().byDbProvider.get(dbProvider);
}

export function getAllProviders(): PaymentProviderRegistration[] {
  return entries();
}

export function getAllDbProviderKeys(): string[] {
  return [...getStore().byDbProvider.keys()];
}

export function getAllClickEventTypes(): string[] {
  return flatMapEntries((reg) => reg.eventTypes.clickEvents);
}

export function getAllSuccessEventTypes(): string[] {
  return flatMapEntries((reg) => reg.eventTypes.successEvents);
}

export function getAllStatsColumns(): StatsColumnDef[] {
  return flatMapEntries((reg) => reg.statsColumns);
}

export function getSuccessEventType(paymentMethod: string, metadata?: Record<string, any>): string {
  const provider = getProviderByMethod(paymentMethod);
  if (!provider) return FALLBACK_SUCCESS;
  const { successEvents } = provider.eventTypes;
  const wantsCardEvent = paymentMethod === 'paypal' && Boolean(metadata?.isCardPayment);
  if (wantsCardEvent && successEvents.length > 1) {
    return successEvents[1];
  }
  return successEvents[0] ?? FALLBACK_SUCCESS;
}

export function getErrorEventType(paymentMethod: string): string {
  return getProviderByMethod(paymentMethod)?.eventTypes.errorEvent || FALLBACK_ERROR;
}

export function getPaymentDisplay(paymentMethod: string): PaymentDisplayInfo {
  const provider = getProviderByMethod(paymentMethod);
  if (provider) return provider.display;
  return { ...FALLBACK_DISPLAY, label: paymentMethod };
}

export function getPaymentDetailDisplay(paymentDetail: string): PaymentDetailInfo {
  const key = paymentDetail.toLowerCase();
  for (const reg of getStore().byMethod.values()) {
    const match = reg.details[key];
    if (match) return match;
  }
  return { ...FALLBACK_DETAIL, label: paymentDetail };
}

export function getDbProviderForMethod(paymentMethod: string): string | undefined {
  return getProviderByMethod(paymentMethod)?.dbProvider;
}

export function unregisterPaymentProvider(dbProvider: string): void {
  const reg = getStore().byDbProvider.get(dbProvider);
  if (!reg) return;
  getStore().byDbProvider.delete(dbProvider);
  getStore().byMethod.delete(reg.paymentMethod);
}

export function isSecretField(field: PaymentFormFieldSpec): boolean {
  return field.type === 'password' || field.secret === true;
}
