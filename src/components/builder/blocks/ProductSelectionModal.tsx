import type { ProductSelectionData, SelectedItem } from './product-selection-types';
import { formatPrice, useProductSelection } from './useProductSelection';
import { useInfiniteProductScroll } from './useInfiniteProductScroll';
import { ModalFooter, ModalHeader, Overlay, ProductSearch, RegionSelector } from './ProductSelectionModalChrome';
import { ProductList } from './ProductSelectionModalRows';

export { formatPrice };

interface ProductSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: SelectedItem[];
  initialCurrency?: string;
  initialRegionId?: string;
  onSelect: (data: ProductSelectionData) => void;
}

export function ProductSelectionModal({
  isOpen,
  onClose,
  selectedItems,
  initialCurrency,
  initialRegionId,
  onSelect,
}: ProductSelectionModalProps) {
  const h = useProductSelection({ isOpen, selectedItems, initialCurrency, initialRegionId, onSelect, onClose });
  const { scrollRef, sentinelRef } = useInfiniteProductScroll(isOpen, h.loadMore);

  if (!isOpen) return null;

  return (
    <Overlay>
      <ModalHeader onClose={onClose} />
      <RegionSelector h={h} />
      <ProductSearch h={h} />
      <ProductList h={h} scrollRef={scrollRef} sentinelRef={sentinelRef} />
      <ModalFooter h={h} onClose={onClose} />
    </Overlay>
  );
}

export default ProductSelectionModal;
