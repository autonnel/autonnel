import type { IdentityContracts } from './identity';
import type { SettingsContracts } from './settings';
import type { SiteConfigContracts } from './site-config';
import type { CouponContracts } from './coupons';
import type { OrdersContracts } from './orders';
import type { FunnelContracts } from './funnel';
import type { PagesContracts } from './pages';
import type { ShopContracts } from './shop';
import type { StatsContracts } from './stats';
import type { AdsContracts } from './ads';
import type { AnalyticsDiagnosticsContracts } from './analytics-diagnostics';

export interface ApiContracts
  extends IdentityContracts,
    SettingsContracts,
    SiteConfigContracts,
    CouponContracts,
    OrdersContracts,
    FunnelContracts,
    PagesContracts,
    ShopContracts,
    StatsContracts,
    AdsContracts,
    AnalyticsDiagnosticsContracts {}

export type ApiKey = keyof ApiContracts;
export type ApiInput<K extends ApiKey> = ApiContracts[K] extends { input: infer I } ? I : never;
export type ApiOutput<K extends ApiKey> = ApiContracts[K] extends { output: infer O } ? O : never;
