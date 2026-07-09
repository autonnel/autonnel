import { type ReactNode } from 'react';
import { scaledFontSize } from '../TextField';
import { formatPrice, type Product } from './useProductSelection';
import { EditButton, InlineEditInput, ResetButton } from './ProductSelectionEditing';
import type { SelectionHandle, Variant } from './product-selection-modal-types';
import { colors, selectedTone, spinnerStyle } from './product-selection-modal-styles';
import {
  CheckMark,
  EmptyProducts,
  ErrorProducts,
  LoadingMore,
  LoadingProducts,
  ProductThumb,
  QuantityInput,
} from './ProductSelectionModalChrome';

export function ProductList({
  h,
  scrollRef,
  sentinelRef,
}: {
  h: SelectionHandle;
  scrollRef: React.RefObject<HTMLDivElement>;
  sentinelRef: React.RefObject<HTMLDivElement>;
}) {
  let content: ReactNode;

  if (h.loading) {
    content = <LoadingProducts />;
  } else if (h.error) {
    content = <ErrorProducts error={h.error} />;
  } else if (h.filteredProducts.length === 0) {
    content = <EmptyProducts />;
  } else {
    content = (
      <>
        {h.filteredProducts.map(product => (
          <ProductRow key={product.id} product={product} h={h} />
        ))}
        {h.loadingMore && <LoadingMore />}
        <div ref={sentinelRef} style={{ height: 1 }} />
      </>
    );
  }

  return <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '12px 20px' }}>{content}</div>;
}

function ProductTitle({ product, productSelected, h }: { product: Product; productSelected: boolean; h: SelectionHandle }) {
  const hasVariants = product.variants.length > 0;

  if (!hasVariants && productSelected && h.editingId === product.id) {
    return (
      <InlineEditInput
        value={h.editingDraft}
        onChange={h.setEditingDraft}
        onConfirm={h.commitEditing}
        onCancel={h.cancelEditing}
        fontSize={14}
        fontWeight={500}
        iconSize={14}
        buttonPadding="3px 6px"
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: scaledFontSize(14), fontWeight: 500, color: colors.ink }}>
        {!hasVariants && productSelected ? h.getDisplayName(product.id, product.name) : product.name}
      </span>
      {!hasVariants && productSelected && (
        <>
          <EditButton onClick={() => h.startEditing(product.id)} size={13} title="Edit product name" />
          {h.isNameCustomized(product.id, 'productName') && (
            <ResetButton onClick={() => h.resetItemName(product.id, 'productName')} size={13} />
          )}
        </>
      )}
    </div>
  );
}

function ProductRow({ product, h }: { product: Product; h: SelectionHandle }) {
  const hasVariants = product.variants.length > 0;
  const isExpanded = h.expandedProducts.has(product.id);
  const productSelected = !hasVariants && h.isItemSelected(product.id);
  const priced = h.pricedProducts.get(product.id);
  const isPricingLoading = h.pricingProductIds.has(product.id);
  const displayProduct = priced || product;
  const displayCurrency = priced ? (priced.currency || h.currentCurrency) : h.currentCurrency;

  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderRadius: 8,
          cursor: 'pointer',
          ...selectedTone(productSelected),
        }}
        onClick={() => hasVariants ? h.toggleProductExpanded(product.id) : h.handleSelect(displayProduct)}
      >
        {hasVariants
          ? <span style={{ fontSize: scaledFontSize(12), color: colors.muted, width: 20 }}>{isExpanded ? '▼' : '▶'}</span>
          : <CheckMark active={productSelected} />
        }
        <ProductThumb product={product} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <ProductTitle product={product} productSelected={productSelected} h={h} />
          {hasVariants && (
            <div style={{ fontSize: scaledFontSize(12), color: colors.muted }}>
              {product.variants.length} variants
            </div>
          )}
        </div>
        {!hasVariants && (
          <div style={{ fontSize: scaledFontSize(14), fontWeight: 600, color: colors.ink }}>
            {formatPrice(displayProduct.price, displayCurrency)}
          </div>
        )}
        {!hasVariants && productSelected && (
          <QuantityInput
            value={h.localSelected.find(item => item.id === product.id)?.quantity || 1}
            onChange={quantity => h.updateQuantity(product.id, quantity)}
            fontSize={13}
            labelSize={12}
            width={48}
          />
        )}
      </div>

      {hasVariants && isExpanded && (
        <div style={{ marginLeft: 32, marginTop: 4 }}>
          {isPricingLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', fontSize: scaledFontSize(12), color: colors.muted }}>
              <div style={spinnerStyle(14, 2)} />
              Loading market prices...
            </div>
          )}
          {displayProduct.variants.map(variant => (
            <VariantRow
              key={variant.id}
              variant={variant}
              product={product}
              displayProduct={displayProduct}
              displayCurrency={displayCurrency}
              h={h}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantTitle({
  variant,
  selected,
  h,
}: {
  variant: Variant;
  selected: boolean;
  h: SelectionHandle;
}) {
  if (selected && h.editingId === variant.id && h.editingField === 'variantName') {
    return (
      <InlineEditInput
        value={h.editingDraft}
        onChange={h.setEditingDraft}
        onConfirm={h.commitEditing}
        onCancel={h.cancelEditing}
        fontSize={13}
        iconSize={12}
        buttonPadding="2px 5px"
      />
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: scaledFontSize(13), color: colors.slate }}>
      <span>{selected ? (h.localSelected.find(item => item.id === variant.id)?.variantName || variant.name) : variant.name}</span>
      {selected && (
        <>
          <EditButton onClick={() => h.startEditing(variant.id, 'variantName')} size={11} title="Edit variant name" />
          {h.isNameCustomized(variant.id, 'variantName') && (
            <ResetButton onClick={() => h.resetItemName(variant.id, 'variantName')} size={11} />
          )}
        </>
      )}
    </div>
  );
}

function VariantProductName({ variant, product, h }: { variant: Variant; product: Product; h: SelectionHandle }) {
  if (h.editingId === variant.id && h.editingField === 'productName') {
    return (
      <div style={{ marginTop: 3 }}>
        <InlineEditInput
          value={h.editingDraft}
          onChange={h.setEditingDraft}
          onConfirm={h.commitEditing}
          onCancel={h.cancelEditing}
          fontSize={11}
          iconSize={10}
          buttonPadding="2px 4px"
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
      <span style={{ fontSize: scaledFontSize(11), color: colors.faint }}>
        {h.getDisplayName(variant.id, product.name)}
      </span>
      <EditButton onClick={() => h.startEditing(variant.id, 'productName')} size={10} color={colors.input} title="Edit product name" />
      {h.isNameCustomized(variant.id, 'productName') && (
        <ResetButton onClick={() => h.resetItemName(variant.id, 'productName')} size={10} />
      )}
    </div>
  );
}

function VariantRow({
  variant,
  product,
  displayProduct,
  displayCurrency,
  h,
}: {
  variant: Variant;
  product: Product;
  displayProduct: Product;
  displayCurrency: string;
  h: SelectionHandle;
}) {
  const selected = h.isItemSelected(variant.id);

  return (
    <div
      onClick={() => h.handleSelect(displayProduct, variant)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 4,
        ...selectedTone(selected),
        background: selected ? 'rgba(37, 99, 235, 0.04)' : colors.surface,
      }}
    >
      <CheckMark active={selected} size={18} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <VariantTitle variant={variant} selected={selected} h={h} />
        {selected && <VariantProductName variant={variant} product={product} h={h} />}
      </div>
      <div style={{ fontSize: scaledFontSize(13), fontWeight: 600, color: colors.ink }}>
        {formatPrice(variant.price, displayCurrency)}
      </div>
      {selected && (
        <QuantityInput
          value={h.localSelected.find(item => item.id === variant.id)?.quantity || 1}
          onChange={quantity => h.updateQuantity(variant.id, quantity)}
          fontSize={12}
          labelSize={11}
          width={44}
        />
      )}
    </div>
  );
}
