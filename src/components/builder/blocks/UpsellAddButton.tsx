import React, { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api/client';
import { createURLField, getURLString, type URLFieldValue } from '../URLField';
import {
  createTextField,
  getTextContent,
  getTextStyle,
  hasText,
  scaledFontSize,
  type TextFieldValue,
} from '../TextField';
import { useTranslation } from '../LanguageContext';
import { normalizeSelection, type SelectedItem, type ProductSelectionData } from './product-selection-types';
import { ProductSelectorField } from './ProductSelectorField';

export interface UpsellAddButtonProps {
  // Product the button adds to the order. Pick one in the editor; the first item
  // is used. Falls back to a live on-page selector event, then the discrete
  // product* props below, so existing pages keep working.
  selectedProduct?: SelectedItem[] | ProductSelectionData;
  addButtonText?: string | TextFieldValue;
  addButtonColor?: string;
  declineButtonText?: string | TextFieldValue;
  declineButtonColor?: string;
  showDeclineButton?: boolean;
  declineUrl?: string | URLFieldValue;
  buttonSize?: 'small' | 'medium' | 'large';
  buttonRadius?: number;
  fullWidth?: boolean;
  showGuarantee?: boolean;
  guaranteeText?: string | TextFieldValue;
  processingText?: string;
  productId?: string;
  variantId?: string;
  productName?: string;
  productPrice?: number;
  productSku?: string;
  quantity?: number;
}

interface SelectedProduct {
  id: string;
  productId: string;
  productName: string;
  variantName?: string;
  price: number;
  quantity: number;
}

interface OrderContext {
  orderId: string | null;
  trackingId: string | null;
  funnelId: string | null;
  pageId: string | null;
  upsellIndex: number;
}

const UPSELL_ENDPOINT = 'POST /api/shop/upsell';

const EVT_PRODUCTS_SELECTED = 'autonnel:productsSelected';
const EVT_REQUEST_SELECTION = 'autonnel:requestProductSelection';
const EVT_ACCEPTED = 'autonnel:upsellAccepted';
const EVT_DECLINED = 'autonnel:upsellDeclined';

const TRACKING_KEYS = ['anid', 'goid', 'trackingId'] as const;

const FONT_BY_SIZE: Record<'small' | 'medium' | 'large', number> = {
  small: 14,
  medium: 16,
  large: 18,
};

const PAD_BY_SIZE: Record<'small' | 'medium' | 'large', string> = {
  small: '12px 24px',
  medium: '16px 32px',
  large: '20px 40px',
};

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 16,
  padding: '24px 0',
};

const spinnerStyle: React.CSSProperties = {
  width: 20,
  height: 20,
  border: '2px solid rgba(255, 255, 255, 0.3)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
};

const errorBoxStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: scaledFontSize(14),
  padding: '8px 16px',
  background: '#fef2f2',
  borderRadius: 6,
  width: '100%',
  maxWidth: 500,
  textAlign: 'center',
};

const SPINNER_KEYFRAMES = '@keyframes spin { to { transform: rotate(360deg); } }';

function readOrderContext(): OrderContext | null {
  if (typeof window === 'undefined') return null;
  const query = new URLSearchParams(window.location.search);
  let tracking: string | null = null;
  for (const key of TRACKING_KEYS) {
    tracking = query.get(key);
    if (tracking) break;
  }
  const win = window as unknown as { __AUTONNEL_PAGE_ID__?: string; __AUTONNEL_FUNNEL_ID__?: string };
  return {
    orderId: query.get('orderId'),
    trackingId: tracking,
    funnelId: query.get('funnelId') || win.__AUTONNEL_FUNNEL_ID__ || null,
    pageId: win.__AUTONNEL_PAGE_ID__ || null,
    upsellIndex: Number.parseInt(query.get('upsellIndex') || '0', 10),
  };
}

export function UpsellAddButton({
  addButtonText = 'Yes! Add to My Order',
  addButtonColor = '#16a34a',
  declineButtonText = "No thanks, I'll pass on this offer",
  declineButtonColor = 'transparent',
  showDeclineButton = true,
  declineUrl = '',
  buttonSize = 'large',
  buttonRadius = 10,
  fullWidth = true,
  showGuarantee = true,
  guaranteeText = '30-Day Money Back Guarantee',
  processingText = 'Adding to order...',
  selectedProduct,
  productId: staticProductId,
  variantId: staticVariantId,
  productName: staticProductName,
  productPrice: staticProductPrice,
  productSku,
  quantity: staticQuantity = 1,
}: UpsellAddButtonProps) {
  const t = useTranslation();
  const [chosen, setChosen] = useState<SelectedProduct | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onSelected = (e: Event) => {
      const list = (e as CustomEvent).detail?.products;
      const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
      setChosen(first);
    };
    window.addEventListener(EVT_PRODUCTS_SELECTED, onSelected);
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent(EVT_REQUEST_SELECTION));
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(EVT_PRODUCTS_SELECTED, onSelected);
    };
  }, [staticProductId]);

  const bound = normalizeSelection(selectedProduct).items[0];
  const productId = chosen?.productId || bound?.productId || staticProductId;
  const variantId = chosen?.id || bound?.id || staticVariantId;
  const productName = chosen?.productName || bound?.productName || staticProductName;
  const productPrice = chosen?.price ?? bound?.price ?? staticProductPrice;
  const quantity = chosen?.quantity || bound?.quantity || staticQuantity;

  const sizePadding = PAD_BY_SIZE[buttonSize];
  const sizeFontSize = scaledFontSize(FONT_BY_SIZE[buttonSize]);

  const acceptLabel = getTextContent(addButtonText);
  const acceptStyle = getTextStyle(addButtonText, {
    color: '#ffffff',
    fontSize: FONT_BY_SIZE[buttonSize],
  });

  const declineLabel = getTextContent(declineButtonText);
  const declineStyle = getTextStyle(declineButtonText, { color: '#6b7280', fontSize: 13 });

  const guaranteeLabel = getTextContent(guaranteeText);
  const guaranteeStyle = getTextStyle(guaranteeText, { color: '#6b7280', fontSize: 13 });

  const acceptFontSize = acceptStyle.fontSize || sizeFontSize;
  const iconFontSize = (sizeFontSize as unknown as number) + 4;

  const accept = async () => {
    const ctx = readOrderContext();
    if (!ctx?.orderId || !ctx?.trackingId) {
      setError(t('addToOrder.missingOrderInfo'));
      return;
    }
    if (!productId) {
      setError(t('addToOrder.noProductSelected'));
      return;
    }
    setProcessing(true);
    setError(null);
    try {
      const data = await apiCall(UPSELL_ENDPOINT, {
        trackingId: ctx.trackingId,
        parentOrderId: ctx.orderId,
        action: 'accept',
        productId,
        variantId,
        quantity,
        upsellIndex: ctx.upsellIndex,
        funnelId: ctx.funnelId ?? undefined,
        pageId: ctx.pageId ?? undefined,
      });
      if (data.success && data.nextStepUrl) {
        window.dispatchEvent(
          new CustomEvent(EVT_ACCEPTED, {
            detail: {
              action: 'accept',
              productId,
              variantId,
              upsellOrder: data.order,
              timestamp: Date.now(),
            },
          }),
        );
        window.location.href = data.nextStepUrl;
        return;
      }
      setError((data as { error?: string }).error || t('addToOrder.failedToAdd'));
      setProcessing(false);
    } catch (err) {
      console.error('Upsell error:', err);
      setError(t('addToOrder.failedToProcess'));
      setProcessing(false);
    }
  };

  const decline = async () => {
    const ctx = readOrderContext();
    window.dispatchEvent(
      new CustomEvent(EVT_DECLINED, {
        detail: { action: 'decline', productId, timestamp: Date.now() },
      }),
    );
    if (ctx?.orderId && ctx?.trackingId) {
      try {
        const data = await apiCall(UPSELL_ENDPOINT, {
          trackingId: ctx.trackingId,
          parentOrderId: ctx.orderId,
          action: 'decline',
          productId,
          upsellIndex: ctx.upsellIndex,
          funnelId: ctx.funnelId ?? undefined,
          pageId: ctx.pageId ?? undefined,
        });
        if (data.success && data.nextStepUrl) {
          window.location.href = data.nextStepUrl;
          return;
        }
      } catch (err) {
        console.error('Decline API error:', err);
      }
    }
    const fallback = getURLString(declineUrl);
    if (fallback) window.location.href = fallback;
  };

  const acceptButtonStyle: React.CSSProperties = {
    padding: sizePadding,
    fontSize: acceptFontSize,
    width: fullWidth ? '100%' : 'auto',
    maxWidth: 500,
    background: processing ? '#9ca3af' : addButtonColor,
    color: acceptStyle.color || 'white',
    border: 'none',
    borderRadius: buttonRadius,
    fontWeight: 700,
    cursor: processing ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    transition: 'all 0.2s ease',
    boxShadow: processing ? 'none' : '0 4px 14px rgba(0, 0, 0, 0.15)',
  };

  const declineButtonStyle: React.CSSProperties = {
    padding: '12px 24px',
    background: declineButtonColor,
    ...declineStyle,
    border: 'none',
    borderRadius: buttonRadius,
    cursor: 'pointer',
    textDecoration: 'underline',
    transition: 'all 0.2s ease',
  };

  const guaranteeRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    ...guaranteeStyle,
  };

  const acceptInner = processing ? (
    <>
      <span style={spinnerStyle} />
      {processingText}
    </>
  ) : (
    <>
      <span style={{ fontSize: iconFontSize }}>✅</span>
      {acceptLabel}
    </>
  );

  return (
    <div style={wrapperStyle}>
      <button onClick={accept} disabled={processing} style={acceptButtonStyle}>
        {acceptInner}
      </button>

      {showGuarantee && hasText(guaranteeText) && (
        <div style={guaranteeRowStyle}>
          <span>🛡️</span>
          <span>{guaranteeLabel}</span>
        </div>
      )}

      {error && <div style={errorBoxStyle}>{error}</div>}

      {showDeclineButton && (
        <button onClick={decline} style={declineButtonStyle}>
          {declineLabel}
        </button>
      )}

      <style>{SPINNER_KEYFRAMES}</style>
    </div>
  );
}

export const UpsellAddButtonConfig = {
  label: 'Add to Order Button',
  fields: {
    selectedProduct: {
      type: 'custom' as const,
      label: 'Upsell Product',
      render: ({ value, onChange }: { value: SelectedItem[] | ProductSelectionData; onChange: (value: ProductSelectionData) => void }) => (
        <ProductSelectorField value={value || { items: [], currency: 'USD' }} onChange={onChange} />
      ),
    },
    addButtonText: createTextField({
      label: 'Add Button Text',
      defaultColor: '#ffffff',
      defaultFontSize: 18,
    }),
    addButtonColor: { type: 'text', label: 'Add Button Color' },
    declineButtonText: createTextField({
      label: 'Decline Button Text',
      defaultColor: '#6b7280',
      defaultFontSize: 13,
    }),
    showDeclineButton: {
      type: 'radio',
      label: 'Show Decline Button',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    declineUrl: createURLField({
      label: 'Decline URL (fallback redirect)',
      placeholder: 'Enter URL or select funnel step',
    }) as any,
    buttonSize: {
      type: 'select',
      label: 'Button Size',
      options: [
        { label: 'Small', value: 'small' },
        { label: 'Medium', value: 'medium' },
        { label: 'Large', value: 'large' },
      ],
    },
    buttonRadius: { type: 'number', label: 'Button Radius', min: 0, max: 32 },
    fullWidth: {
      type: 'radio',
      label: 'Full Width',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showGuarantee: {
      type: 'radio',
      label: 'Show Guarantee',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    guaranteeText: createTextField({
      label: 'Guarantee Text',
      defaultColor: '#6b7280',
      defaultFontSize: 13,
    }),
    processingText: { type: 'text', label: 'Processing Text', contentEditable: true },
  },
  defaultProps: {
    selectedProduct: { items: [], currency: 'USD' },
    addButtonText: { text: 'Yes! Add to My Order', color: '#ffffff', fontSize: 18 },
    addButtonColor: '#16a34a',
    declineButtonText: { text: "No thanks, I'll pass on this offer", color: '#6b7280', fontSize: 13 },
    declineButtonColor: 'transparent',
    showDeclineButton: true,
    declineUrl: { type: 'custom', url: '' },
    buttonSize: 'large',
    buttonRadius: 10,
    fullWidth: true,
    showGuarantee: true,
    guaranteeText: { text: '30-Day Money Back Guarantee', color: '#6b7280', fontSize: 13 },
    processingText: 'Adding to order...',
  },
  render: UpsellAddButton,
};

export default UpsellAddButton;
