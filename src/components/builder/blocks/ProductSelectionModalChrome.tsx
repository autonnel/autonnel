import { type ReactNode } from 'react';
import { scaledFontSize } from '../TextField';
import type { Product } from './useProductSelection';
import type { SelectionHandle } from './product-selection-modal-types';
import { colors, spinKeyframes, spinnerStyle } from './product-selection-modal-styles';

export function Overlay({ children }: { children: ReactNode }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 12,
        width: '90%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <h3 style={{ fontSize: scaledFontSize(18), fontWeight: 600, color: colors.ink, margin: 0 }}>
        Select Products
      </h3>
      <button
        type="button"
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          fontSize: scaledFontSize(24),
          color: colors.muted,
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

export function RegionSelector({ h }: { h: SelectionHandle }) {
  if (h.regions.length <= 1) return null;

  return (
    <div style={{
      padding: '10px 20px',
      borderBottom: `1px solid ${colors.border}`,
      background: colors.surface,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <label style={{ fontSize: scaledFontSize(13), fontWeight: 500, color: colors.slate, whiteSpace: 'nowrap' }}>
        Market:
      </label>
      <select
        value={h.selectedRegionId}
        onChange={event => h.handleRegionChange(event.target.value)}
        disabled={h.regionsLoading}
        style={{
          flex: 1,
          padding: '7px 10px',
          borderRadius: 7,
          border: `1px solid ${colors.input}`,
          fontSize: scaledFontSize(13),
          color: colors.ink,
          background: 'white',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {h.regions.map(region => (
          <option key={region.id} value={region.id}>{region.name} ({region.currencyCode})</option>
        ))}
      </select>
      <span style={{
        fontSize: scaledFontSize(12),
        color: colors.muted,
        background: '#e5e7eb',
        padding: '4px 8px',
        borderRadius: 4,
        fontWeight: 500,
      }}>
        {h.currentCurrency}
      </span>
    </div>
  );
}

export function ProductSearch({ h }: { h: SelectionHandle }) {
  return (
    <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border}` }}>
      <input
        type="text"
        placeholder="Search products or variants..."
        value={h.searchTerm}
        onChange={event => h.setSearchTerm(event.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 7,
          border: `1px solid ${colors.input}`,
          fontSize: scaledFontSize(14),
          outline: 'none',
        }}
      />
    </div>
  );
}

export function CenterMessage({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: colors.muted }}>
      {icon}
      {title && <p style={{ color: colors.danger, fontSize: scaledFontSize(14), fontWeight: 500, marginBottom: 8 }}>{title}</p>}
      {children}
    </div>
  );
}

export function LoadingProducts() {
  return (
    <CenterMessage
      icon={<div style={{ ...spinnerStyle(32), margin: '0 auto' }} />}
    >
      <p style={{ marginTop: 12, color: colors.muted, fontSize: scaledFontSize(13) }}>
        Loading products from e-commerce system...
      </p>
      <style>{spinKeyframes}</style>
    </CenterMessage>
  );
}

export function ErrorProducts({ error }: { error: string }) {
  return (
    <CenterMessage
      title="Configuration Required"
      icon={
        <div style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: '#fef2f2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
        }}>
          <span style={{ fontSize: scaledFontSize(24) }}>!</span>
        </div>
      }
    >
      <p style={{ color: colors.muted, fontSize: scaledFontSize(13), lineHeight: 1.5, maxWidth: 400, margin: '0 auto' }}>
        {error}
      </p>
    </CenterMessage>
  );
}

export function EmptyProducts() {
  return (
    <CenterMessage icon={<span style={{ fontSize: scaledFontSize(32), display: 'block', marginBottom: 8 }}>No products found</span>}>
      <p style={{ fontSize: scaledFontSize(12), marginTop: 8 }}>Add products in your e-commerce platform first</p>
    </CenterMessage>
  );
}

export function LoadingMore() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: '12px 0',
      color: colors.muted,
      fontSize: scaledFontSize(12),
    }}>
      <div style={spinnerStyle(14, 2)} />
      Loading more products...
    </div>
  );
}

export function ActionButton({
  children,
  onClick,
  variant = 'plain',
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: 'plain' | 'danger' | 'warning' | 'primary';
}) {
  const palette = {
    plain: { background: 'white', color: colors.ink, border: `1px solid ${colors.input}` },
    danger: { background: colors.dangerBg, color: colors.dangerText, border: `1px solid ${colors.dangerBorder}` },
    warning: { background: colors.amberBg, color: colors.amberText, border: `1px solid ${colors.amberBorder}` },
    primary: { background: colors.ink, color: 'white', border: `1px solid ${colors.ink}` },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: variant === 'plain' || variant === 'primary' ? '9px 18px' : '6px 12px',
        borderRadius: 7,
        border: palette.border,
        background: palette.background,
        fontSize: scaledFontSize(variant === 'plain' || variant === 'primary' ? 14 : 13),
        fontWeight: 500,
        color: palette.color,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function ModalFooter({ h, onClose }: { h: SelectionHandle; onClose: () => void }) {
  const count = h.localSelected.length;

  return (
    <div style={{
      padding: '16px 20px',
      borderTop: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: scaledFontSize(14), color: colors.muted }}>
          {count} item{count !== 1 ? 's' : ''} selected
        </span>
        {count > 0 && <ActionButton variant="danger" onClick={h.clearAll}>Clear All</ActionButton>}
        {h.hasAnyCustomizedNames && <ActionButton variant="warning" onClick={h.resetAllNames}>Reset All Names</ActionButton>}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <ActionButton onClick={onClose}>Cancel</ActionButton>
        <ActionButton variant="primary" onClick={h.handleConfirm}>Confirm Selection</ActionButton>
      </div>
    </div>
  );
}

export function CheckMark({ active, size = 20 }: { active: boolean; size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 4,
      flexShrink: 0,
      border: `2px solid ${active ? colors.accent : colors.input}`,
      background: active ? colors.accent : 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {active && (
        <svg width={size - 8} height={size - 8} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  );
}

export function ProductThumb({ product }: { product: Product }) {
  return (
    <div style={{
      width: 40,
      height: 40,
      borderRadius: 6,
      background: '#f3f4f6',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {product.thumbnail
        ? <img src={product.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: scaledFontSize(18), color: colors.faint }}>P</span>
      }
    </div>
  );
}

export function QuantityInput({
  value,
  onChange,
  fontSize,
  labelSize,
  width,
}: {
  value: number;
  onChange: (quantity: number) => void;
  fontSize: number;
  labelSize: number;
  width: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }} onClick={event => event.stopPropagation()}>
      <span style={{ fontSize: scaledFontSize(labelSize), color: colors.muted }}>Qty:</span>
      <input
        type="number"
        min={1}
        max={999}
        value={value}
        onChange={event => {
          const next = parseInt(event.target.value, 10);
          if (!Number.isNaN(next) && next >= 1 && next <= 999) onChange(next);
        }}
        style={{
          width,
          padding: width > 44 ? '3px 4px' : '2px 4px',
          borderRadius: 4,
          border: `1px solid ${colors.input}`,
          fontSize: scaledFontSize(fontSize),
          textAlign: 'center',
          outline: 'none',
        }}
      />
    </div>
  );
}
