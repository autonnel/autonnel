export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
}

export interface FunnelPage {
  id: string;
  pageId: string;
  pageType: string;
  order: number;
  subOrder: number;
  stepSlug: string | null;
  nextUrl: string | null;
  page?: Page;
}

export interface Funnel {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  pages: FunnelPage[];
}

export interface FunnelValidationError {
  funnelPageId: string;
  pageId: string;
  pageName: string;
  pageType: string;
  error: string;
  expectedUrl?: string;
}

type Cardinality = 'single' | 'repeatable';

interface PageTypeSpec {
  key: string;
  label: string;
  workflowRank: number;
  dbType: string;
  cardinality: Cardinality;
  mandatory: boolean;
}

const PAGE_TYPE_SPECS: readonly PageTypeSpec[] = [
  { key: 'LANDING', label: 'Landing Page', workflowRank: 1, dbType: 'CUSTOM', cardinality: 'repeatable', mandatory: false },
  { key: 'CHECKOUT', label: 'Checkout Page', workflowRank: 2, dbType: 'CHECKOUT', cardinality: 'single', mandatory: true },
  { key: 'THANKYOU', label: 'Thank You Page', workflowRank: 4, dbType: 'THANKYOU', cardinality: 'single', mandatory: false },
  { key: 'UPSELL', label: 'Upsell Page', workflowRank: 3, dbType: 'UPSELL', cardinality: 'repeatable', mandatory: false },
  { key: 'ERROR', label: 'Error Page', workflowRank: 5, dbType: 'ERROR', cardinality: 'single', mandatory: false },
];

const keysWhere = (predicate: (spec: PageTypeSpec) => boolean): string[] =>
  PAGE_TYPE_SPECS.filter(predicate).map((spec) => spec.key);

const mapBy = <V>(pick: (spec: PageTypeSpec) => V): Record<string, V> =>
  Object.fromEntries(PAGE_TYPE_SPECS.map((spec) => [spec.key, pick(spec)]));

export const PAGE_TYPE_LABELS: Record<string, string> = mapBy((s) => s.label);

export const PAGE_TYPE_ORDER: Record<string, number> = mapBy((s) => s.workflowRank);

export const FUNNEL_TO_DB_PAGE_TYPE: Record<string, string> = mapBy((s) => s.dbType);

// Reverse of FUNNEL_TO_DB_PAGE_TYPE: a page's stored type decides its funnel role,
// not its position in the step list (CUSTOM pages act as LANDING steps).
export const DB_TO_FUNNEL_PAGE_TYPE: Record<string, string> = Object.fromEntries(
  PAGE_TYPE_SPECS.map((s) => [s.dbType, s.key]),
);

export const PAGE_TYPES = PAGE_TYPE_SPECS.map((s) => s.key);

export const UNIQUE_PAGE_TYPES = keysWhere((s) => s.cardinality === 'single');

export const MULTI_PAGE_TYPES = keysWhere((s) => s.cardinality === 'repeatable');

export const REQUIRED_FUNNEL_PAGES = keysWhere((s) => s.mandatory);
