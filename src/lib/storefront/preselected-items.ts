import type { SelectedItem } from '@/components/builder/blocks/product-selection-types';

export const PRESELECTED_ITEMS_GLOBAL = '__AUTONNEL_PRESELECTED_ITEMS__';

export interface PreselectedItems {
  items: SelectedItem[];
  currency: string;
  regionId?: string;
}
