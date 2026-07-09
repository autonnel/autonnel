import React, { useEffect, useState } from 'react';
import { createColorField } from '../ColorField';
import { createTextField, scaledFontSize, type TextFieldValue } from '../TextField';
import { SectionTitle, titleIconField, type TitleIconType } from '../SectionTitle';
import { useTranslation } from '../LanguageContext';

export interface StandaloneShippingFormProps {
  sectionTitle?: string | TextFieldValue;
  titleIcon?: TitleIconType;
  type?: 'shipping' | 'billing' | 'both';
  backgroundColor?: string;
  borderColor?: string;
  padding?: number;
}

interface AddressData {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

type Option = { code: string; name: string };

const COUNTRIES: Option[] = [
  ['US', 'United States'],
  ['CA', 'Canada'],
  ['GB', 'United Kingdom'],
  ['AU', 'Australia'],
  ['DE', 'Germany'],
  ['FR', 'France'],
  ['IT', 'Italy'],
  ['ES', 'Spain'],
  ['NL', 'Netherlands'],
  ['BE', 'Belgium'],
  ['AT', 'Austria'],
  ['CH', 'Switzerland'],
  ['SE', 'Sweden'],
  ['NO', 'Norway'],
  ['DK', 'Denmark'],
  ['FI', 'Finland'],
  ['IE', 'Ireland'],
  ['NZ', 'New Zealand'],
  ['JP', 'Japan'],
  ['SG', 'Singapore'],
  ['HK', 'Hong Kong'],
  ['MX', 'Mexico'],
  ['BR', 'Brazil'],
].map(([code, name]) => ({ code, name }));

const US_STATES: Option[] = [
  ['AL', 'Alabama'],
  ['AK', 'Alaska'],
  ['AZ', 'Arizona'],
  ['AR', 'Arkansas'],
  ['CA', 'California'],
  ['CO', 'Colorado'],
  ['CT', 'Connecticut'],
  ['DE', 'Delaware'],
  ['FL', 'Florida'],
  ['GA', 'Georgia'],
  ['HI', 'Hawaii'],
  ['ID', 'Idaho'],
  ['IL', 'Illinois'],
  ['IN', 'Indiana'],
  ['IA', 'Iowa'],
  ['KS', 'Kansas'],
  ['KY', 'Kentucky'],
  ['LA', 'Louisiana'],
  ['ME', 'Maine'],
  ['MD', 'Maryland'],
  ['MA', 'Massachusetts'],
  ['MI', 'Michigan'],
  ['MN', 'Minnesota'],
  ['MS', 'Mississippi'],
  ['MO', 'Missouri'],
  ['MT', 'Montana'],
  ['NE', 'Nebraska'],
  ['NV', 'Nevada'],
  ['NH', 'New Hampshire'],
  ['NJ', 'New Jersey'],
  ['NM', 'New Mexico'],
  ['NY', 'New York'],
  ['NC', 'North Carolina'],
  ['ND', 'North Dakota'],
  ['OH', 'Ohio'],
  ['OK', 'Oklahoma'],
  ['OR', 'Oregon'],
  ['PA', 'Pennsylvania'],
  ['RI', 'Rhode Island'],
  ['SC', 'South Carolina'],
  ['SD', 'South Dakota'],
  ['TN', 'Tennessee'],
  ['TX', 'Texas'],
  ['UT', 'Utah'],
  ['VT', 'Vermont'],
  ['VA', 'Virginia'],
  ['WA', 'Washington'],
  ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'],
  ['WY', 'Wyoming'],
  ['DC', 'District of Columbia'],
].map(([code, name]) => ({ code, name }));

const PO_BOX_REGEX =
  /(?:^|\s|,)(?:p\.?\s*o\.?\s*box|p\.?\s*o\.?\s*b\.?(?:\s|$|[0-9#])|post\s+office\s+box)/i;

const REQUIRED_FIELDS = ['address1', 'city', 'postalCode'] as const;

const DANGER = '#ef4444';
const INK = '#333333';

const blankAddress = (): AddressData => ({
  address1: '',
  address2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'US',
});

const withAlpha = (set: Set<string>, key: string, add: boolean): Set<string> => {
  const copy = new Set(set);
  if (add) copy.add(key);
  else copy.delete(key);
  return copy;
};

const focusByName = (name: string) => {
  const node = document.querySelector<HTMLElement>(`[name="${name}"]`);
  if (!node) return;
  node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.focus();
};

export function StandaloneShippingForm(props: StandaloneShippingFormProps) {
  const {
    sectionTitle = { text: 'Shipping Address', color: INK, fontSize: 15 },
    titleIcon = 'none',
    type = 'shipping',
    backgroundColor = '#ffffff',
    borderColor = '#cccccc',
    padding = 24,
  } = props;

  const t = useTranslation();
  const [shipping, setShipping] = useState<AddressData>(blankAddress);
  const [billing, setBilling] = useState<AddressData>(blankAddress);
  const [reuseShipping, setReuseShipping] = useState(true);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [poBoxHits, setPoBoxHits] = useState<Set<string>>(new Set());

  useEffect(() => {
    const onValidationError = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const found = new Set<string>();

      if (detail.poBox) {
        found.add('address1');
      } else {
        REQUIRED_FIELDS.forEach((field) => {
          if (!String(shipping[field] ?? '').trim()) found.add(field);
        });
      }

      if (found.size === 0) return;

      setErrors(found);
      if (detail.poBox) setPoBoxHits((prev) => withAlpha(prev, 'address1', true));

      const target = [...found][0];
      window.setTimeout(() => focusByName(target), 100);
    };

    const evt = 'autonnel:formValidationError';
    window.addEventListener(evt, onValidationError);
    return () => window.removeEventListener(evt, onValidationError);
  }, [shipping]);

  useEffect(() => {
    const billingPayload =
      type === 'both' ? (reuseShipping ? shipping : billing) : undefined;
    window.dispatchEvent(
      new CustomEvent('autonnel:standaloneAddressChange', {
        detail: {
          type,
          shipping,
          billing: billingPayload,
          sameAsBilling: reuseShipping,
        },
      }),
    );
  }, [shipping, billing, reuseShipping, type]);

  const editField = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    forBilling = false,
  ) => {
    const { name, value } = e.target;

    setErrors((prev) => (prev.has(name) ? withAlpha(prev, name, false) : prev));

    if (name === 'address1' || name === 'address2') {
      const isPoBox = PO_BOX_REGEX.test(value);
      console.log('[StandaloneShippingForm] PO box check', { name, value, isPoBox });
      setPoBoxHits((prev) => withAlpha(prev, name, isPoBox));
    }

    const apply = forBilling ? setBilling : setShipping;
    apply((prev) => ({ ...prev, [name]: value }));
  };

  const baseInput: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 4,
    border: '1px solid ' + borderColor,
    fontSize: scaledFontSize(14),
    fontFamily: 'inherit',
    color: INK,
    background: 'white',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const highlightIf = (flag: boolean): React.CSSProperties => ({
    ...baseInput,
    borderColor: flag ? DANGER : borderColor,
  });

  const requiredInput = (name: string): React.CSSProperties =>
    highlightIf(errors.has(name) || poBoxHits.has(name));

  const errorText: React.CSSProperties = {
    color: DANGER,
    fontSize: scaledFontSize(12),
    marginTop: 4,
  };

  const labelText: React.CSSProperties = {
    display: 'block',
    fontSize: scaledFontSize(13),
    fontWeight: 'var(--autonnel-label-fw, 700)' as React.CSSProperties['fontWeight'],
    color: INK,
    marginBottom: 4,
  };

  const fieldError = (message: string) => <p style={errorText}>{message}</p>;

  const stateControl = (data: AddressData, onChange: AddressHandler) => {
    if (data.country === 'US') {
      return (
        <select
          name="state"
          value={data.state}
          onChange={onChange}
          required
          style={baseInput}
        >
          <option value="">{t('address.selectState')}</option>
          {US_STATES.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>
      );
    }
    return (
      <input
        type="text"
        name="state"
        value={data.state}
        onChange={onChange}
        placeholder={t('address.stateProvince')}
        style={baseInput}
      />
    );
  };

  const addressFields = (data: AddressData, onChange: AddressHandler) => {
    const a1HasPoBox = poBoxHits.has('address1');
    const a2HasPoBox = poBoxHits.has('address2');
    const poBoxMessage = 'PO Box addresses are not allowed';
    const requiredMessage = 'This field is required';

    return (
      <>
        <div style={{ marginBottom: 12 }}>
          <label style={labelText}>{t('address.streetLabel')}</label>
          <input
            type="text"
            name="address1"
            value={data.address1}
            onChange={onChange}
            placeholder={t('address.streetPlaceholder')}
            required
            style={requiredInput('address1')}
          />
          {a1HasPoBox && fieldError(poBoxMessage)}
          {errors.has('address1') && !a1HasPoBox && fieldError(requiredMessage)}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={labelText}>{t('address.aptLabel')}</label>
          <input
            type="text"
            name="address2"
            value={data.address2}
            onChange={onChange}
            placeholder={t('address.aptPlaceholder')}
            style={highlightIf(a2HasPoBox)}
          />
          {a2HasPoBox && fieldError(poBoxMessage)}
        </div>

        <div className="autonnel-form-grid-2" style={{ marginBottom: 12 }}>
          <div>
            <label style={labelText}>{t('address.cityLabel')}</label>
            <input
              type="text"
              name="city"
              value={data.city}
              onChange={onChange}
              placeholder="New York"
              required
              style={requiredInput('city')}
            />
            {errors.has('city') && fieldError(requiredMessage)}
          </div>
          <div>
            <label style={labelText}>{t('address.stateLabel')}</label>
            {stateControl(data, onChange)}
          </div>
        </div>

        <div className="autonnel-form-grid-2">
          <div>
            <label style={labelText}>{t('address.zipLabel')}</label>
            <input
              type="text"
              name="postalCode"
              value={data.postalCode}
              onChange={onChange}
              placeholder="10001"
              required
              style={requiredInput('postalCode')}
            />
            {errors.has('postalCode') && fieldError(requiredMessage)}
          </div>
          <div>
            <label style={labelText}>{t('address.countryLabel')}</label>
            <select
              name="country"
              value={data.country}
              onChange={onChange}
              required
              style={baseInput}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </>
    );
  };

  const showBilling = type === 'both';

  return (
    <div
      style={{ background: backgroundColor, padding }}
      className="autonnel-address-form"
      data-form-type={type}
    >
      {sectionTitle && (
        <div
          style={{
            marginBottom: 12,
            paddingBottom: 8,
            borderBottom: '1px solid ' + borderColor,
          }}
        >
          <SectionTitle title={sectionTitle} titleIcon={titleIcon} marginBottom={0} />
        </div>
      )}

      {addressFields(shipping, (e) => editField(e, false))}

      {showBilling && (
        <div style={{ marginTop: 16 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '8px 0',
            }}
          >
            <input
              type="checkbox"
              checked={reuseShipping}
              onChange={(e) => setReuseShipping(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span
              style={{
                fontSize: scaledFontSize(13),
                fontWeight: 500,
                color: INK,
              }}
            >
              {t('address.billingSameAsShipping')}
            </span>
          </label>
          {!reuseShipping && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid ' + borderColor,
              }}
            >
              <span
                style={{
                  fontSize: scaledFontSize(15),
                  fontWeight: 700,
                  color: '#333',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {t('address.billingAddress')}
              </span>
              {addressFields(billing, (e) => editField(e, true))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type AddressHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
) => void;

export const StandaloneShippingFormConfig = {
  label: 'Standalone Address Form',
  fields: {
    sectionTitle: createTextField({
      label: 'Section Title',
      defaultColor: '#333333',
      defaultFontSize: 15,
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
    backgroundColor: createColorField({ label: 'Background Color' }),
    borderColor: createColorField({ label: 'Border Color' }),
    padding: { type: 'number' as const, label: 'Padding', min: 0, max: 64 },
  },
  defaultProps: {
    sectionTitle: { text: 'Shipping Address', color: '#333333', fontSize: 15 },
    titleIcon: 'none',
    type: 'shipping',
    backgroundColor: '#ffffff',
    borderColor: '#cccccc',
    padding: 24,
  },
  render: StandaloneShippingForm,
};

export default StandaloneShippingForm;
