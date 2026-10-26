import type { PreselectedItems } from '@/lib/storefront/preselected-items';

export const PRODUCTS_SELECTED_EVENT = 'autonnel:productsSelected';
export const REQUEST_SELECTION_EVENT = 'autonnel:requestProductSelection';
const BOUND_FLAG = '__autonnelPreselectionBound__';

export interface ProductSelectionDetail {
  products: PreselectedItems['items'];
  total: number;
  currency: string;
  regionId?: string;
  userInitiated: boolean;
}

type PreselectionWindow = Pick<Window, 'addEventListener' | 'dispatchEvent'> & {
  __AUTONNEL_PRESELECTED_ITEMS__?: PreselectedItems | null;
  [BOUND_FLAG]?: boolean;
};

// userInitiated is false: the buyer clicked nothing, so this must not count as a selection.
export function buildPreselectionDetail(preselected: PreselectedItems): ProductSelectionDetail {
  return {
    products: preselected.items,
    total: preselected.items.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0),
    currency: preselected.currency,
    regionId: preselected.regionId,
    userInitiated: false,
  };
}

// Islands hydrate after the initial broadcast, so the preselection keeps answering selection
// requests with its own rows. It goes silent for good once anyone else broadcasts a non-empty
// selection (a selector on the page or the buyer), so a URL never overrides a visible choice.
export function bindPreselection(win: PreselectionWindow = window): boolean {
  const preselected = win.__AUTONNEL_PRESELECTED_ITEMS__;
  if (!preselected?.items?.length || win[BOUND_FLAG]) return false;
  win[BOUND_FLAG] = true;

  let deferred = false;
  let dispatching = false;

  win.addEventListener(PRODUCTS_SELECTED_EVENT, (event) => {
    if (dispatching) return;
    const products = (event as CustomEvent).detail?.products;
    if (Array.isArray(products) && products.length > 0) deferred = true;
  });

  const answer = () => {
    if (deferred) return;
    dispatching = true;
    try {
      win.dispatchEvent(new CustomEvent(PRODUCTS_SELECTED_EVENT, { detail: buildPreselectionDetail(preselected) }));
    } finally {
      dispatching = false;
    }
  };

  win.addEventListener(REQUEST_SELECTION_EVENT, answer);
  answer();
  return true;
}
