import React, { useEffect, useRef, useState } from 'react';
import { createColorField } from '../ColorField';
import { createTextField, scaledFontSize, type TextFieldValue } from '../TextField';
import { useTranslation } from '../LanguageContext';
import { SectionTitle, titleIconField, type TitleIconType } from '../SectionTitle';
import {
  EMAIL_REGEX,
  PO_BOX_REGEX,
  emptyAddressData,
  isBrowser,
  type AddressData,
  type Prediction,
} from './ShippingAddressForm.parts/data';
import { buildStyles, makeFieldStyle } from './ShippingAddressForm.parts/styles';
import { ContactFields } from './ShippingAddressForm.parts/ContactFields';
import { AddressFields } from './ShippingAddressForm.parts/AddressFields';

export interface ShippingAddressFormProps {
  sectionTitle?: string | TextFieldValue;
  titleIcon?: TitleIconType;
  type?: 'shipping' | 'billing' | 'both';
  showPhone?: boolean;
  showEmail?: boolean;
  showAddress?: boolean;
  useGoogleAutocomplete?: boolean;
  googleApiKey?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  padding?: number;
  fieldRadius?: number;
  fieldHeight?: number;
  fieldBackground?: string;
  fieldTextColor?: string;
  labelColor?: string;
  placeholderColor?: string;
  detailGroupBackground?: string;
  detailGroupPadding?: number;
  addressPlaceholder?: string;
  // 'always' (default) shows every address field up front; 'on-focus' shows a single
  // collapsed line that expands to the full fields on focus (matches autocomplete-style designs).
  addressDisclosure?: 'always' | 'on-focus';
}

export function ShippingAddressForm({
  sectionTitle = { text: 'Shipping Address', color: '#1a1a1a', fontSize: 16 } as any,
  titleIcon = 'checkmark',
  type = 'shipping',
  showPhone = true,
  showEmail = true,
  showAddress = true,
  useGoogleAutocomplete = true,
  googleApiKey = '',
  backgroundColor = '#ffffff',
  borderColor = '#e5e7eb',
  borderRadius = 12,
  padding = 24,
  fieldRadius = 4,
  fieldHeight,
  fieldBackground,
  fieldTextColor = '#333333',
  labelColor = '#333333',
  placeholderColor,
  detailGroupBackground = '#f9fafb',
  detailGroupPadding = 16,
  addressPlaceholder = 'Start typing your address…',
  addressDisclosure = 'always',
}: ShippingAddressFormProps) {
  const t = useTranslation();
  const scope = 'aaf-' + React.useId().replace(/:/g, '');

  const [formData, setFormData] = useState<AddressData>(emptyAddressData);
  const [billingData, setBillingData] = useState<AddressData>(emptyAddressData);
  const [showDetailedAddress, setShowDetailedAddress] = useState(false);
  const [showDetailedBilling, setShowDetailedBilling] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(true);
  const [googleMapsAvailable, setGoogleMapsAvailable] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [billingPredictions, setBillingPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [showBillingPredictions, setShowBillingPredictions] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [formatErrors, setFormatErrors] = useState<Set<string>>(new Set());
  const [poBoxFields, setPoBoxFields] = useState<Set<string>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);
  const billingSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isBrowser) return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as { fields?: string[] } | undefined;
      const fields = detail?.fields ?? [];
      setValidationErrors(new Set(fields));
      setShowDetailedAddress(true);
      const first = fields[0];
      if (first) {
        const el = document.querySelector(`[name="${first}"]`) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }
    };
    window.addEventListener('autonnel:formValidationError', handler);
    return () => window.removeEventListener('autonnel:formValidationError', handler);
  }, []);

  useEffect(() => {
    if (!isBrowser) return;
    window.dispatchEvent(
      new CustomEvent('autonnel:addressChange', {
        detail: { type, formData, billingData, sameAsBilling },
      }),
    );
  }, [type, formData, billingData, sameAsBilling]);

  useEffect(() => {
    if (!isBrowser) return;
    if (!useGoogleAutocomplete || !googleApiKey) {
      if (addressDisclosure === 'always') {
        setShowDetailedAddress(true);
        setShowDetailedBilling(true);
      }
      return;
    }
    let cancelled = false;
    const win = window as unknown as { google?: { maps?: unknown } };
    const markReady = () => {
      if (!cancelled) setGoogleMapsAvailable(true);
    };
    if (win.google?.maps) {
      markReady();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-autonnel-gmaps]');
    if (existing) {
      existing.addEventListener('load', markReady);
      return () => {
        cancelled = true;
        existing.removeEventListener('load', markReady);
      };
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.autonnelGmaps = 'true';
    script.addEventListener('load', markReady);
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      script.removeEventListener('load', markReady);
    };
  }, [useGoogleAutocomplete, googleApiKey, addressDisclosure]);

  const { inputStyle, labelStyle, errorMsgStyle } = buildStyles(borderColor, {
    radius: fieldRadius,
    height: fieldHeight,
    fieldBackground,
    textColor: fieldTextColor,
    labelColor,
  });
  const getFieldStyle = makeFieldStyle(inputStyle, borderColor, validationErrors, poBoxFields);

  const validateEmail = (value: string) => {
    setFormatErrors((prev) => {
      const next = new Set(prev);
      if (value && !EMAIL_REGEX.test(value)) next.add('email');
      else next.delete('email');
      return next;
    });
  };

  const validatePoBox = (name: string, value: string) => {
    setPoBoxFields((prev) => {
      const next = new Set(prev);
      if (value && PO_BOX_REGEX.test(value)) next.add(name);
      else next.delete(name);
      return next;
    });
  };

  const updateField = (
    setData: React.Dispatch<React.SetStateAction<AddressData>>,
    name: keyof AddressData,
    value: string,
  ) => {
    setData((prev) => ({ ...prev, [name]: value }));
  };

  const onShippingSearchChange = (value: string) => {
    updateField(setFormData, 'addressSearch', value);
    setShowPredictions(value.length > 0);
  };

  const onBillingSearchChange = (value: string) => {
    updateField(setBillingData, 'addressSearch', value);
    setShowBillingPredictions(value.length > 0);
  };

  const selectShippingPrediction = (prediction: Prediction) => {
    setShowPredictions(false);
    setShowDetailedAddress(true);
    setPredictions([]);
    void prediction;
  };

  const selectBillingPrediction = (prediction: Prediction) => {
    setShowBillingPredictions(false);
    setShowDetailedBilling(true);
    setBillingPredictions([]);
    void prediction;
  };

  return (
    <div
      style={{ background: backgroundColor, borderRadius, padding }}
      className={`autonnel-address-form ${scope}`}
      data-form-type={type}
    >
      {placeholderColor ? (
        <style>{`.${scope} input::placeholder{color:${placeholderColor};opacity:1}`}</style>
      ) : null}
      <SectionTitle title={sectionTitle ?? ''} titleIcon={titleIcon} />

      <ContactFields
        showEmail={showEmail}
        showPhone={showPhone}
        formData={formData}
        labelStyle={labelStyle}
        errorMsgStyle={errorMsgStyle}
        getFieldStyle={getFieldStyle}
        formatErrors={formatErrors}
        validationErrors={validationErrors}
        updateField={updateField}
        setFormData={setFormData}
        validateEmail={validateEmail}
        t={t}
      />

      {showAddress && (
        <AddressFields
          data={formData}
          setData={setFormData}
          onSearchChange={onShippingSearchChange}
          inputRef={searchInputRef}
          showDetailed={showDetailedAddress}
          setShowDetailed={setShowDetailedAddress}
          isGoogleMapsAvailable={googleMapsAvailable}
          predictionList={predictions}
          showPredictionsList={showPredictions}
          onSelectPrediction={selectShippingPrediction}
          inputStyle={inputStyle}
          borderColor={borderColor}
          useGoogleAutocomplete={useGoogleAutocomplete}
          labelStyle={labelStyle}
          errorMsgStyle={errorMsgStyle}
          getFieldStyle={getFieldStyle}
          validationErrors={validationErrors}
          poBoxFields={poBoxFields}
          updateField={updateField}
          validatePoBox={validatePoBox}
          detailGroupBackground={detailGroupBackground}
          detailGroupPadding={detailGroupPadding}
          addressPlaceholder={addressPlaceholder}
          addressDisclosure={addressDisclosure}
          t={t}
        />
      )}

      {showAddress && type === 'both' && (
        <div style={{ marginTop: 24 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '12px 16px',
              background: sameAsBilling
                ? 'rgba(34, 197, 94, 0.1)'
                : 'rgba(0, 0, 0, 0.02)',
              borderRadius: 10,
              border: sameAsBilling
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : '1px solid ' + borderColor,
            }}
          >
            <input
              type="checkbox"
              checked={sameAsBilling}
              onChange={(e) => setSameAsBilling(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#22c55e' }}
            />
            <span
              style={{
                fontSize: scaledFontSize(14),
                fontWeight: 500,
                color: '#374151',
              }}
            >
              {t('address.billingSameAsShipping')}
            </span>
          </label>

          {!sameAsBilling && (
            <div style={{ marginTop: 16 }}>
              <h3
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: scaledFontSize(16),
                  fontWeight: 700,
                  color: '#111827',
                  marginBottom: 16,
                }}
              >
                🧾 {t('address.billingAddress')}
              </h3>
              <AddressFields
                data={billingData}
                setData={setBillingData}
                onSearchChange={onBillingSearchChange}
                inputRef={billingSearchInputRef}
                showDetailed={showDetailedBilling}
                setShowDetailed={setShowDetailedBilling}
                isGoogleMapsAvailable={googleMapsAvailable}
                predictionList={billingPredictions}
                showPredictionsList={showBillingPredictions}
                onSelectPrediction={selectBillingPrediction}
                inputStyle={inputStyle}
                borderColor={borderColor}
                useGoogleAutocomplete={useGoogleAutocomplete}
                labelStyle={labelStyle}
                errorMsgStyle={errorMsgStyle}
                getFieldStyle={getFieldStyle}
                validationErrors={validationErrors}
                poBoxFields={poBoxFields}
                updateField={updateField}
                validatePoBox={validatePoBox}
                detailGroupBackground={detailGroupBackground}
                detailGroupPadding={detailGroupPadding}
                addressPlaceholder={addressPlaceholder}
                addressDisclosure={addressDisclosure}
                t={t}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ShippingAddressFormConfig = {
  label: 'Address Form',
  fields: {
    sectionTitle: createTextField({
      label: 'Section Title',
      defaultColor: '#1a1a1a',
      defaultFontSize: 16,
    }),
    titleIcon: titleIconField,
    type: {
      type: 'radio' as const,
      label: 'Address Type',
      options: [
        { label: 'Shipping Only', value: 'shipping' },
        { label: 'Billing Only', value: 'billing' },
        { label: 'Both (with toggle)', value: 'both' },
      ],
    },
    showPhone: {
      type: 'radio' as const,
      label: 'Show Phone Field',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showEmail: {
      type: 'radio' as const,
      label: 'Show Email Field',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    showAddress: {
      type: 'radio' as const,
      label: 'Show Address Fields',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    useGoogleAutocomplete: {
      type: 'radio' as const,
      label: 'Use Google Address Autocomplete',
      options: [
        { label: 'Yes', value: true },
        { label: 'No', value: false },
      ],
    },
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderColor: createColorField({ label: 'Border Color' }),
    borderRadius: {
      type: 'number' as const,
      label: 'Border Radius',
      min: 0,
      max: 32,
    },
    padding: {
      type: 'number' as const,
      label: 'Padding',
      min: 0,
      max: 64,
    },
    fieldRadius: { type: 'number' as const, label: 'Field Radius', min: 0, max: 24 },
    fieldHeight: { type: 'number' as const, label: 'Field Height (0 = auto)', min: 0, max: 72 },
    fieldBackground: createColorField({ label: 'Field Background' }),
    fieldTextColor: createColorField({ label: 'Field Text Color' }),
    labelColor: createColorField({ label: 'Label Color' }),
    placeholderColor: createColorField({ label: 'Placeholder Color' }),
    detailGroupBackground: createColorField({ label: 'Address Group Background' }),
    detailGroupPadding: { type: 'number' as const, label: 'Address Group Padding', min: 0, max: 32 },
    addressPlaceholder: { type: 'text' as const, label: 'Address Placeholder' },
    addressDisclosure: {
      type: 'radio' as const,
      label: 'Address Fields',
      options: [
        { label: 'Show all', value: 'always' },
        { label: 'Expand on focus', value: 'on-focus' },
      ],
    },
  },
  defaultProps: {
    sectionTitle: { text: 'Shipping Address', color: '#1a1a1a', fontSize: 16 },
    titleIcon: 'checkmark',
    type: 'shipping',
    showPhone: true,
    showEmail: true,
    showAddress: true,
    useGoogleAutocomplete: true,
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 24,
    fieldRadius: 4,
    detailGroupBackground: '#f9fafb',
    detailGroupPadding: 16,
    addressDisclosure: 'always',
  },
  render: ShippingAddressForm,
};

export default ShippingAddressForm;
