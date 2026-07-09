
import React, { useState } from 'react';
import { EditableProductName, normalizeSelection, type SelectedItem, type ProductSelectionData } from './product-selection-types';
import { ProductSelectionModal, formatPrice } from './ProductSelectionModal';
import { scaledFontSize } from '../TextField';

function changeItemAt(items: SelectedItem[], index: number, patch: Partial<SelectedItem>): SelectedItem[] {
  const next = [...items];
  next[index] = { ...next[index], ...patch };
  return next;
}

function reorderItems(items: SelectedItem[], from: number, to: number): SelectedItem[] {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function itemHasBadge(item: SelectedItem): boolean {
  return !!(item.badgeLabel || item.isMostPopular);
}

function selectorButtonStyle(): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 7,
    border: '1px solid #D1D5DB',
    background: 'white',
    fontSize: scaledFontSize(13),
    color: '#4B5563',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
}

function reorderButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: 0,
    border: 'none',
    background: 'none',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: scaledFontSize(10),
    lineHeight: 1,
    color: disabled ? '#d1d5db' : '#6b7280',
  };
}

function ReorderControls({
  index,
  itemCount,
  onMove,
}: {
  index: number;
  itemCount: number;
  onMove: (to: number) => void;
}) {
  const isFirst = index === 0;
  const isLast = index === itemCount - 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isFirst) onMove(index - 1);
        }}
        disabled={isFirst}
        style={reorderButtonStyle(isFirst)}
      >▲</button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (!isLast) onMove(index + 1);
        }}
        disabled={isLast}
        style={reorderButtonStyle(isLast)}
      >▼</button>
    </div>
  );
}

function BadgeEditor({
  item,
  onUpdate,
  onClear,
  onSetDefault,
}: {
  item: SelectedItem;
  onUpdate: (patch: { badgeLabel?: string; badgeColor?: string }) => void;
  onClear: () => void;
  onSetDefault: () => void;
}) {
  const active = itemHasBadge(item);
  const displayLabel = item.badgeLabel || (item.isMostPopular ? 'Most Popular' : '');
  const displayColor = item.badgeColor || '#0ea5e9';

  return (
    <div style={{ marginTop: 4, marginLeft: 18, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {active ? (
        <>
          <input
            type="color"
            value={displayColor}
            onChange={(e) => onUpdate({ badgeLabel: displayLabel, badgeColor: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 18, height: 18, border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer', padding: 0, flexShrink: 0 }}
            title="Badge color"
          />
          <input
            value={displayLabel}
            onChange={(e) => onUpdate({ badgeLabel: e.target.value, badgeColor: displayColor })}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 90, fontSize: scaledFontSize(11), padding: '2px 4px',
              border: '1px solid #d1d5db', borderRadius: 3, color: '#374151', background: 'white',
            }}
            placeholder="Tag text"
          />
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{
              padding: '1px 4px', borderRadius: 3, border: '1px solid #FECACA',
              background: '#FEF2F2', color: '#991B1B',
              fontSize: scaledFontSize(10), cursor: 'pointer', flexShrink: 0,
            }}
            title="Remove tag"
          >✕</button>
        </>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onSetDefault(); }}
          style={{
            padding: '2px 6px', borderRadius: 4, border: '1px dashed #D1D5DB',
            background: 'transparent', color: '#9CA3AF',
            fontSize: scaledFontSize(10), fontWeight: 500, cursor: 'pointer',
          }}
        >
          + Tag
        </button>
      )}
    </div>
  );
}

function SelectedProductPreview({
  item,
  index,
  itemCount,
  currency,
  onMove,
  onNameChange,
  onBadgeUpdate,
  onBadgeClear,
  onBadgeDefault,
}: {
  item: SelectedItem;
  index: number;
  itemCount: number;
  currency: string;
  onMove: (to: number) => void;
  onNameChange: (fields: { productName?: string; variantName?: string }) => void;
  onBadgeUpdate: (patch: { badgeLabel?: string; badgeColor?: string }) => void;
  onBadgeClear: () => void;
  onBadgeDefault: () => void;
}) {
  const activeBadge = itemHasBadge(item);
  return (
    <div
      style={{
        padding: '6px 8px',
        background: activeBadge ? 'rgba(37, 99, 235, 0.06)' : '#FAFAFB',
        borderRadius: 6,
        marginBottom: 4,
        fontSize: scaledFontSize(12),
        border: activeBadge ? '1px solid #2563EB' : '1px solid #E5E7EB',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <ReorderControls index={index} itemCount={itemCount} onMove={onMove} />
        <EditableProductName item={item} onSave={onNameChange} />
        <span style={{ color: '#111827', fontWeight: 500, flexShrink: 0 }}>
          {formatPrice(item.price, currency)}
        </span>
      </div>

      <BadgeEditor
        item={item}
        onUpdate={onBadgeUpdate}
        onClear={onBadgeClear}
        onSetDefault={onBadgeDefault}
      />
    </div>
  );
}

export function ProductSelectorField({
  value,
  onChange,
}: {
  value: SelectedItem[] | ProductSelectionData;
  onChange: (value: ProductSelectionData) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const selection = normalizeSelection(value);

  const handleNameChange = (index: number, fields: { productName?: string; variantName?: string }) => {
    onChange({ ...selection, items: changeItemAt(selection.items, index, fields) });
  };

  const handleReorder = (newItems: SelectedItem[]) => {
    onChange({ ...selection, items: newItems });
  };

  const updateItemBadge = (index: number, patch: { badgeLabel?: string; badgeColor?: string }) => {
    onChange({
      ...selection,
      items: changeItemAt(selection.items, index, {
        ...patch,
        isMostPopular: undefined,
      }),
    });
  };

  const clearItemBadge = (index: number) => {
    onChange({
      ...selection,
      items: changeItemAt(selection.items, index, {
        badgeLabel: undefined,
        badgeColor: undefined,
        isMostPopular: undefined,
      }),
    });
  };

  const setDefaultBadge = (index: number) => {
    updateItemBadge(index, {
      badgeLabel: 'Most Popular',
      badgeColor: '#0ea5e9',
    });
  };

  return (
    <div>
      <button
        onClick={() => setModalOpen(true)}
        style={selectorButtonStyle()}
      >
        <span>
          {selection.items.length > 0
            ? `${selection.items.length} product${selection.items.length > 1 ? 's' : ''} selected (${selection.currency})`
            : 'Click to select products'
          }
        </span>
        <span style={{ fontSize: scaledFontSize(16) }}>📦</span>
      </button>


      {selection.items.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {selection.items.map((item, index) => (
            <SelectedProductPreview
              key={item.id}
              item={item}
              index={index}
              itemCount={selection.items.length}
              currency={selection.currency}
              onMove={(to) => handleReorder(reorderItems(selection.items, index, to))}
              onNameChange={(fields) => handleNameChange(index, fields)}
              onBadgeUpdate={(patch) => updateItemBadge(index, patch)}
              onBadgeClear={() => clearItemBadge(index)}
              onBadgeDefault={() => setDefaultBadge(index)}
            />
          ))}
        </div>
      )}

      <ProductSelectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedItems={selection.items}
        initialCurrency={selection.currency}
        initialRegionId={selection.regionId}
        onSelect={onChange}
      />
    </div>
  );
}

export default ProductSelectorField;
