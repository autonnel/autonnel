import React from 'react';
import { useTranslation } from '../../LanguageContext';
import type { AddressData } from './data';

type Translate = ReturnType<typeof useTranslation>;

export function ContactFields({
  showEmail,
  showPhone,
  formData,
  labelStyle,
  errorMsgStyle,
  getFieldStyle,
  formatErrors,
  validationErrors,
  updateField,
  setFormData,
  validateEmail,
  t,
}: {
  showEmail: boolean;
  showPhone: boolean;
  formData: AddressData;
  labelStyle: React.CSSProperties;
  errorMsgStyle: React.CSSProperties;
  getFieldStyle: (name: string) => React.CSSProperties;
  formatErrors: Set<string>;
  validationErrors: Set<string>;
  updateField: (
    setData: React.Dispatch<React.SetStateAction<AddressData>>,
    name: keyof AddressData,
    value: string,
  ) => void;
  setFormData: React.Dispatch<React.SetStateAction<AddressData>>;
  validateEmail: (value: string) => void;
  t: Translate;
}) {
  return (
    <>
      {showEmail && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('address.emailLabel')}</label>
          <input
            type="email"
            name="email"
            placeholder={t('address.emailPlaceholder')}
            required
            value={formData.email}
            onChange={(e) => updateField(setFormData, 'email', e.target.value)}
            onBlur={(e) => validateEmail(e.target.value)}
            style={getFieldStyle('email')}
          />
          {(formatErrors.has('email') || validationErrors.has('email')) && (
            <p style={errorMsgStyle}>
              {formatErrors.has('email')
                ? 'Please enter a valid email address'
                : 'This field is required'}
            </p>
          )}
        </div>
      )}

      <div className="autonnel-form-grid-2" style={{ marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>{t('address.firstNameLabel')}</label>
          <input
            type="text"
            name="firstName"
            placeholder={t('address.firstNamePlaceholder')}
            required
            value={formData.firstName}
            onChange={(e) => updateField(setFormData, 'firstName', e.target.value)}
            style={getFieldStyle('firstName')}
          />
          {validationErrors.has('firstName') && (
            <p style={errorMsgStyle}>This field is required</p>
          )}
        </div>
        <div>
          <label style={labelStyle}>{t('address.lastNameLabel')}</label>
          <input
            type="text"
            name="lastName"
            placeholder={t('address.lastNamePlaceholder')}
            required
            value={formData.lastName}
            onChange={(e) => updateField(setFormData, 'lastName', e.target.value)}
            style={getFieldStyle('lastName')}
          />
          {validationErrors.has('lastName') && (
            <p style={errorMsgStyle}>This field is required</p>
          )}
        </div>
      </div>

      {showPhone && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>{t('address.phoneLabel')}</label>
          <input
            type="tel"
            name="phone"
            placeholder={t('address.phonePlaceholder')}
            required
            value={formData.phone}
            onChange={(e) => updateField(setFormData, 'phone', e.target.value)}
            style={getFieldStyle('phone')}
          />
          {validationErrors.has('phone') && (
            <p style={errorMsgStyle}>This field is required</p>
          )}
        </div>
      )}
    </>
  );
}
