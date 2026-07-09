import React from 'react';
import { scaledFontSize } from '../../TextField';
import { useTranslation } from '../../LanguageContext';
import { COUNTRIES, US_STATES, type AddressData, type Prediction } from './data';

type Translate = ReturnType<typeof useTranslation>;

export function AddressFields({
  data,
  setData,
  onSearchChange,
  inputRef,
  showDetailed,
  setShowDetailed,
  isGoogleMapsAvailable,
  predictionList,
  showPredictionsList,
  onSelectPrediction,
  inputStyle,
  borderColor,
  useGoogleAutocomplete,
  labelStyle,
  errorMsgStyle,
  getFieldStyle,
  validationErrors,
  poBoxFields,
  updateField,
  validatePoBox,
  detailGroupBackground = '#f9fafb',
  detailGroupPadding = 16,
  addressPlaceholder = 'Start typing your address…',
  addressDisclosure = 'always',
  t,
}: {
  data: AddressData;
  setData: React.Dispatch<React.SetStateAction<AddressData>>;
  onSearchChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  showDetailed: boolean;
  setShowDetailed: (value: boolean) => void;
  isGoogleMapsAvailable: boolean;
  predictionList: Prediction[];
  showPredictionsList: boolean;
  onSelectPrediction: (prediction: Prediction) => void;
  inputStyle: React.CSSProperties;
  borderColor: string;
  useGoogleAutocomplete: boolean;
  labelStyle: React.CSSProperties;
  errorMsgStyle: React.CSSProperties;
  getFieldStyle: (name: string) => React.CSSProperties;
  validationErrors: Set<string>;
  poBoxFields: Set<string>;
  updateField: (
    setData: React.Dispatch<React.SetStateAction<AddressData>>,
    name: keyof AddressData,
    value: string,
  ) => void;
  validatePoBox: (name: string, value: string) => void;
  detailGroupBackground?: string;
  detailGroupPadding?: number;
  addressPlaceholder?: string;
  addressDisclosure?: 'always' | 'on-focus';
  t: Translate;
}) {
  const showCollapsedLine = addressDisclosure === 'on-focus' && !showDetailed && !isGoogleMapsAvailable;
  return (
    <>
      {showCollapsedLine && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('address.streetLabel')}</label>
          <input
            type="text"
            name="address1"
            value={data.address1}
            placeholder={addressPlaceholder}
            onChange={(e) => updateField(setData, 'address1', e.target.value)}
            onFocus={() => setShowDetailed(true)}
            style={getFieldStyle('address1')}
          />
        </div>
      )}

      {isGoogleMapsAvailable && (
        <div style={{ marginBottom: 16, position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              📍
            </span>
            <input
              ref={inputRef}
              type="text"
              name="addressSearch"
              value={data.addressSearch}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 44 }}
            />
          </div>
          {showPredictionsList && predictionList.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                background: 'white',
                border: '1px solid ' + borderColor,
                borderRadius: 8,
                marginTop: 4,
              }}
            >
              {predictionList.map((prediction) => (
                <button
                  key={prediction.place_id}
                  type="button"
                  onClick={() => onSelectPrediction(prediction)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {prediction.structured_formatting.main_text}
                  </span>{' '}
                  <span style={{ color: '#6b7280' }}>
                    {prediction.structured_formatting.secondary_text}
                  </span>
                </button>
              ))}
            </div>
          )}
          {useGoogleAutocomplete && !showDetailed && (
            <p style={{ fontSize: scaledFontSize(12), color: '#6b7280', marginTop: 6 }}>
              {t('address.autocompleteHint')}
            </p>
          )}
        </div>
      )}

      {showDetailed && (
        <div style={{ background: detailGroupBackground, borderRadius: detailGroupPadding > 0 ? 10 : 0, padding: detailGroupPadding }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t('address.streetLabel')}</label>
            <input
              type="text"
              name="address1"
              required
              value={data.address1}
              onChange={(e) => {
                updateField(setData, 'address1', e.target.value);
                validatePoBox('address1', e.target.value);
              }}
              style={getFieldStyle('address1')}
            />
            {(validationErrors.has('address1') || poBoxFields.has('address1')) && (
              <p style={errorMsgStyle}>
                {poBoxFields.has('address1')
                  ? 'PO Box addresses are not allowed'
                  : 'This field is required'}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>{t('address.aptLabel')}</label>
            <input
              type="text"
              name="address2"
              value={data.address2}
              onChange={(e) => {
                updateField(setData, 'address2', e.target.value);
                validatePoBox('address2', e.target.value);
              }}
              style={{
                ...inputStyle,
                borderColor: poBoxFields.has('address2') ? '#ef4444' : borderColor,
              }}
            />
          </div>

          <div className="autonnel-form-grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>{t('address.cityLabel')}</label>
              <input
                type="text"
                name="city"
                required
                value={data.city}
                onChange={(e) => updateField(setData, 'city', e.target.value)}
                style={getFieldStyle('city')}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('address.stateLabel')}</label>
              {data.country === 'US' ? (
                <select
                  name="state"
                  value={data.state}
                  onChange={(e) => updateField(setData, 'state', e.target.value)}
                  style={getFieldStyle('state')}
                >
                  <option value="">{t('address.selectState')}</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  name="state"
                  value={data.state}
                  onChange={(e) => updateField(setData, 'state', e.target.value)}
                  style={getFieldStyle('state')}
                />
              )}
            </div>
          </div>

          <div className="autonnel-form-grid-2">
            <div>
              <label style={labelStyle}>{t('address.zipLabel')}</label>
              <input
                type="text"
                name="postalCode"
                required
                value={data.postalCode}
                onChange={(e) => updateField(setData, 'postalCode', e.target.value)}
                style={getFieldStyle('postalCode')}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('address.countryLabel')}</label>
              <select
                name="country"
                value={data.country}
                onChange={(e) => updateField(setData, 'country', e.target.value)}
                style={getFieldStyle('country')}
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {!showDetailed && isGoogleMapsAvailable && (
        <button
          type="button"
          onClick={() => setShowDetailed(true)}
          style={{
            background: 'none',
            border: 'none',
            color: '#3b82f6',
            cursor: 'pointer',
            fontSize: scaledFontSize(13),
            padding: 0,
          }}
        >
          {t('address.manualEntry')}
        </button>
      )}
    </>
  );
}
