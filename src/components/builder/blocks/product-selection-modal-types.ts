import type { Product, useProductSelection } from './useProductSelection';

export type SelectionHandle = ReturnType<typeof useProductSelection>;
export type Variant = Product['variants'][number];
