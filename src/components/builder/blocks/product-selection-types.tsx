import React, { useState } from 'react';
import { scaledFontSize } from '../TextField';

export type SelectedItem = {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  subtitle?: string;
  price: number;
  comparePrice?: number;
  thumbnail?: string;
  quantity: number;
  isMostPopular?: boolean;
  badgeLabel?: string;
  badgeColor?: string;
  currency?: string;
  regionId?: string;
};

export type ProductSelectionData = {
  items: SelectedItem[];
  currency: string;
  regionId?: string;
};

const FALLBACK_CURRENCY = 'USD';

export function normalizeSelection(
  value?: SelectedItem[] | ProductSelectionData
): ProductSelectionData {
  if (Array.isArray(value)) {
    const [head] = value;
    return {
      items: value,
      currency: head?.currency ?? FALLBACK_CURRENCY,
      regionId: head?.regionId,
    };
  }
  return value ?? { items: [], currency: FALLBACK_CURRENCY };
}

type InlineEditProps = {
  value: string;
  onSave: (v: string) => void;
  style?: React.CSSProperties;
  title?: string;
};

const inputBoxStyle: React.CSSProperties = {
  fontSize: scaledFontSize(12),
  padding: '2px 4px',
  border: '1px solid #3b82f6',
  borderRadius: 3,
  outline: 'none',
  color: '#374151',
  background: 'white',
  minWidth: 0,
  width: '100%',
};

function InlineEdit(props: InlineEditProps) {
  const { value, onSave, style, title } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const reset = () => {
    setDraft(value);
    setIsOpen(false);
  };

  const commit = () => {
    const next = draft.trim();
    if (next.length > 0 && next !== value) {
      onSave(next);
      setIsOpen(false);
    } else {
      reset();
    }
  };

  const handleKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      commit();
    } else if (event.key === 'Escape') {
      reset();
    }
  };

  if (!isOpen) {
    return (
      <span
        title={title ?? 'Click to edit'}
        style={{ cursor: 'text', ...style }}
        onClick={event => {
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        {value}
      </span>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      style={{ ...inputBoxStyle, ...style }}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKey}
      onClick={event => event.stopPropagation()}
    />
  );
}

type EditableProductNameProps = {
  item: SelectedItem;
  onSave: (fields: { productName?: string; variantName?: string }) => void;
};

export function EditableProductName({ item, onSave }: EditableProductNameProps) {
  const wrapStyle: React.CSSProperties = {
    color: '#374151',
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  return (
    <span style={wrapStyle}>
      <InlineEdit
        value={item.productName}
        onSave={name => onSave({ productName: name })}
        title="Click to edit product name"
      />
      {item.variantName ? (
        <>
          <span style={{ color: '#9ca3af' }}> - </span>
          <InlineEdit
            value={item.variantName}
            onSave={name => onSave({ variantName: name })}
            title="Click to edit variant name"
            style={{ color: '#9ca3af' }}
          />
        </>
      ) : null}
    </span>
  );
}
