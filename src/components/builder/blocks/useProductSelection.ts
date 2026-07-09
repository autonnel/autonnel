import { useCallback, useEffect, useRef, useState } from 'react';
import { apiCall } from '@/lib/api/client';
import type {
  ShopProductDto,
  ShopProductListDto,
  ShopProductSingleDto,
  ShopRegionDto,
} from '@/contracts/shop';
import type { SelectedItem, ProductSelectionData } from './product-selection-types';

export type Product = ShopProductDto;
export type Region = ShopRegionDto;

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_CURRENCY = 'USD';

type EditingField = 'productName' | 'variantName';
type NameOverride = { productName?: string; variantName?: string };

export interface UseProductSelectionProps {
  isOpen: boolean;
  selectedItems: SelectedItem[];
  initialCurrency?: string;
  initialRegionId?: string;
  onSelect: (data: ProductSelectionData) => void;
  onClose: () => void;
}

export function formatPrice(amount: number, currencyCode?: string): string {
  const code = currencyCode || DEFAULT_CURRENCY;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

function overridesFromItems(items: SelectedItem[]): Map<string, NameOverride> {
  const out = new Map<string, NameOverride>();
  items.forEach(item => {
    out.set(item.id, { productName: item.productName, variantName: item.variantName });
  });
  return out;
}

function mergeNewProducts(existing: Product[], incoming: Product[]): Product[] {
  const known = new Set(existing.map(p => p.id));
  const fresh = incoming.filter(p => !known.has(p.id));
  return fresh.length ? [...existing, ...fresh] : existing;
}

function withDeletedFromSet<T>(source: Set<T>, key: T): Set<T> {
  const copy = new Set(source);
  copy.delete(key);
  return copy;
}

export function useProductSelection(props: UseProductSelectionProps) {
  const { isOpen, selectedItems, initialCurrency, initialRegionId, onSelect, onClose } = props;

  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const requestSeq = useRef(0);
  const paginationRef = useRef({ loading, loadingMore, hasMore, nextOffset });
  paginationRef.current = { loading, loadingMore, hasMore, nextOffset };

  const [localSelected, setLocalSelected] = useState<SelectedItem[]>(selectedItems);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(() => new Set());

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<EditingField>('productName');
  const [editingDraft, setEditingDraft] = useState('');
  const [customNames, setCustomNames] = useState<Map<string, NameOverride>>(() => new Map());

  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState(initialRegionId || '');
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState(initialCurrency || DEFAULT_CURRENCY);

  const [pricedProducts, setPricedProducts] = useState<Map<string, Product>>(() => new Map());
  const [pricingProductIds, setPricingProductIds] = useState<Set<string>>(() => new Set());

  const buildProductsQuery = useCallback(
    (offset: number) => ({
      limit: PAGE_SIZE,
      offset,
      regionId: selectedRegionId || undefined,
      skipPricing: selectedRegionId ? undefined : 'true',
      q: debouncedSearch || undefined,
    }),
    [selectedRegionId, debouncedSearch],
  );

  // Keyed by a stable signature of the incoming items rather than the array
  // reference; a fresh array each render would otherwise loop this sync forever.
  const incomingSignature = JSON.stringify(
    selectedItems.map(i => [i.id, i.productName, i.variantName]),
  );

  useEffect(() => {
    setLocalSelected(selectedItems);
    setCustomNames(overridesFromItems(selectedItems));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSignature, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let stale = false;
    (async () => {
      setRegionsLoading(true);
      try {
        const data = await apiCall('GET /api/shop/regions', null);
        if (stale) return;
        const list = data.regions || [];
        setRegions(list);
        const preferred =
          initialRegionId && list.find(r => r.id === initialRegionId);
        if (preferred) {
          setSelectedRegionId(preferred.id);
          setCurrentCurrency(preferred.currencyCode || initialCurrency || DEFAULT_CURRENCY);
        } else if (list.length > 0) {
          const [first] = list;
          setSelectedRegionId(first.id);
          setCurrentCurrency(first.currencyCode || DEFAULT_CURRENCY);
        }
      } catch (err) {
        console.error('Failed to fetch regions:', err);
      } finally {
        if (!stale) setRegionsLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) return;
    const ticket = (requestSeq.current += 1);

    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setProducts([]);
    setHasMore(false);
    setNextOffset(0);
    setPricedProducts(new Map());
    setPricingProductIds(new Set());

    (async () => {
      try {
        const data = (await apiCall('GET /api/shop/products', null, {
          query: buildProductsQuery(0),
        })) as ShopProductListDto;
        if (ticket !== requestSeq.current) return;
        const page = data.products;
        if (page?.length) {
          setProducts(page);
          setHasMore(Boolean(data.hasMore));
          setNextOffset(page.length);
        } else if (data.message) {
          setError(data.message + ' Configure it under Settings → Ecommerce.');
        } else if (data.error) {
          setError(data.error + ' Verify credentials in Settings → Ecommerce.');
        }
      } catch (err) {
        if (ticket !== requestSeq.current) return;
        console.error('Failed to fetch products:', err);
        setError('Failed to connect to product API. Please check your configuration.');
      } finally {
        if (ticket === requestSeq.current) setLoading(false);
      }
    })();
  }, [isOpen, selectedRegionId, debouncedSearch, buildProductsQuery]);

  const loadMore = useCallback(async () => {
    const page = paginationRef.current;
    if (!isOpen || page.loading || page.loadingMore || !page.hasMore) return;
    const offset = page.nextOffset;

    const ticket = (requestSeq.current += 1);
    setLoadingMore(true);
    try {
      const data = (await apiCall('GET /api/shop/products', null, {
        query: buildProductsQuery(offset),
      })) as ShopProductListDto;
      if (ticket !== requestSeq.current) return;
      const batch = data.products || [];
      if (batch.length === 0) {
        setHasMore(false);
        return;
      }
      setProducts(prev => mergeNewProducts(prev, batch));
      setNextOffset(offset + batch.length);
      setHasMore(Boolean(data.hasMore));
    } catch (err) {
      console.error('Failed to load more products:', err);
      setHasMore(false);
    } finally {
      if (ticket === requestSeq.current) setLoadingMore(false);
    }
  }, [isOpen, buildProductsQuery]);

  const filteredProducts = products;

  const isItemSelected = useCallback(
    (itemId: string) => localSelected.some(s => s.id === itemId),
    [localSelected],
  );

  const fetchProductPrices = useCallback(
    async (productId: string) => {
      if (pricedProducts.has(productId) || pricingProductIds.has(productId)) return;
      if (!selectedRegionId || selectedRegionId === 'default') return;
      setPricingProductIds(prev => new Set(prev).add(productId));
      try {
        const data = (await apiCall('GET /api/shop/products', null, {
          query: { action: 'single', productId, regionId: selectedRegionId },
        })) as ShopProductSingleDto;
        const product = data.product;
        if (product) {
          setPricedProducts(prev => new Map(prev).set(productId, product));
          if (product.currency) setCurrentCurrency(product.currency);
        }
      } catch (err) {
        console.error(`Failed to fetch prices for product ${productId}:`, err);
      } finally {
        setPricingProductIds(prev => withDeletedFromSet(prev, productId));
      }
    },
    [pricedProducts, pricingProductIds, selectedRegionId],
  );

  const toggleProductExpanded = useCallback(
    (productId: string) => {
      setExpandedProducts(prev => {
        if (prev.has(productId)) return withDeletedFromSet(prev, productId);
        void fetchProductPrices(productId);
        return new Set(prev).add(productId);
      });
    },
    [fetchProductPrices],
  );

  const handleSelect = useCallback(
    (product: Product, variant?: Product['variants'][number]) => {
      if (product.variants.length > 0 && !variant) return;
      const itemId = variant?.id || product.id;
      setLocalSelected(prev => {
        if (prev.some(s => s.id === itemId)) {
          return prev.filter(s => s.id !== itemId);
        }
        const override = customNames.get(itemId);
        const item: SelectedItem = {
          id: itemId,
          productId: product.id,
          productName: override?.productName || product.name,
          variantName: override?.variantName || variant?.name,
          price: variant?.price || product.price,
          comparePrice: variant?.comparePrice ?? product.comparePrice ?? undefined,
          thumbnail: variant?.thumbnail || product.thumbnail || undefined,
          quantity: 1,
        };
        return [...prev, item];
      });
    },
    [customNames],
  );

  const handleRegionChange = useCallback(
    (regionId: string) => {
      setSelectedRegionId(regionId);
      const region = regions.find(r => r.id === regionId);
      if (region) setCurrentCurrency(region.currencyCode);
      setLocalSelected([]);
      setCustomNames(new Map());
      setPricedProducts(new Map());
      setPricingProductIds(new Set());
    },
    [regions],
  );

  const startEditing = useCallback(
    (itemId: string, field: EditingField = 'productName') => {
      const item = localSelected.find(s => s.id === itemId);
      if (!item) return;
      setEditingId(itemId);
      setEditingField(field);
      setEditingDraft(field === 'variantName' ? item.variantName || '' : item.productName);
    },
    [localSelected],
  );

  const commitEditing = useCallback(() => {
    const value = editingDraft.trim();
    if (editingId && value) {
      const id = editingId;
      const field = editingField;
      setLocalSelected(prev => prev.map(s => (s.id === id ? { ...s, [field]: value } : s)));
      setCustomNames(prev => {
        const copy = new Map(prev);
        copy.set(id, { ...copy.get(id), [field]: value });
        return copy;
      });
    }
    setEditingId(null);
    setEditingDraft('');
  }, [editingId, editingField, editingDraft]);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingDraft('');
  }, []);

  const getDisplayName = useCallback(
    (itemId: string, originalName: string) => {
      const item = localSelected.find(s => s.id === itemId);
      return item ? item.productName : originalName;
    },
    [localSelected],
  );

  const getOriginalNames = useCallback(
    (itemId: string): { productName: string; variantName?: string } | null => {
      for (const product of products) {
        if (product.id === itemId) return { productName: product.name };
        const variant = product.variants.find(v => v.id === itemId);
        if (variant) return { productName: product.name, variantName: variant.name };
      }
      return null;
    },
    [products],
  );

  const isNameCustomized = useCallback(
    (itemId: string, field: EditingField) => {
      const item = localSelected.find(s => s.id === itemId);
      const original = item && getOriginalNames(itemId);
      if (!item || !original) return false;
      return field === 'productName'
        ? item.productName !== original.productName
        : item.variantName !== original.variantName;
    },
    [localSelected, getOriginalNames],
  );

  const resetItemName = useCallback(
    (itemId: string, field: EditingField) => {
      const original = getOriginalNames(itemId);
      if (!original) return;
      const value = field === 'variantName' ? original.variantName : original.productName;
      if (!value) return;
      setLocalSelected(prev =>
        prev.map(s => (s.id === itemId ? { ...s, [field]: value } : s)),
      );
      setCustomNames(prev => {
        if (!prev.has(itemId)) return prev;
        const copy = new Map(prev);
        copy.set(itemId, { ...copy.get(itemId), [field]: value });
        return copy;
      });
    },
    [getOriginalNames],
  );

  const resetAllNames = useCallback(() => {
    setLocalSelected(prev =>
      prev.map(s => {
        const original = getOriginalNames(s.id);
        if (!original) return s;
        return {
          ...s,
          productName: original.productName,
          variantName: original.variantName || s.variantName,
        };
      }),
    );
    setCustomNames(new Map());
  }, [getOriginalNames]);

  const hasAnyCustomizedNames = localSelected.some(item => {
    const original = getOriginalNames(item.id);
    if (!original) return false;
    if (item.productName !== original.productName) return true;
    return Boolean(item.variantName) && item.variantName !== original.variantName;
  });

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setLocalSelected(prev => prev.map(s => (s.id === itemId ? { ...s, quantity } : s)));
  }, []);

  const clearAll = useCallback(() => {
    setLocalSelected([]);
  }, []);

  const handleConfirm = useCallback(() => {
    onSelect({
      items: localSelected,
      currency: currentCurrency,
      regionId: selectedRegionId || undefined,
    });
    onClose();
  }, [localSelected, currentCurrency, selectedRegionId, onSelect, onClose]);

  return {
    products,
    filteredProducts,
    loading,
    error,
    loadingMore,
    hasMore,
    loadMore,
    pricedProducts,
    pricingProductIds,
    localSelected,
    isItemSelected,
    handleSelect,
    clearAll,
    updateQuantity,
    expandedProducts,
    toggleProductExpanded,
    searchTerm,
    setSearchTerm,
    regions,
    selectedRegionId,
    regionsLoading,
    currentCurrency,
    handleRegionChange,
    editingId,
    editingField,
    editingDraft,
    setEditingDraft,
    startEditing,
    commitEditing,
    cancelEditing,
    getDisplayName,
    isNameCustomized,
    resetItemName,
    resetAllNames,
    hasAnyCustomizedNames,
    handleConfirm,
  };
}
