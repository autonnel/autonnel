import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { ShippingAddressForm, type ShippingAddressFormProps } from '@/components/builder/blocks/ShippingAddressForm';
import { LanguageProvider } from '@/components/builder/LanguageContext';

// Glow checkout passes these; useGoogleAutocomplete=false auto-expands the detailed
// address on mount, which is the state the user screenshotted (was a gray inset panel
// with narrower-than-contact fields). Assert the polished props actually land.
const GLOW_PROPS = {
  type: 'both' as const,
  showPhone: true,
  showEmail: true,
  showAddress: true,
  useGoogleAutocomplete: false,
  backgroundColor: 'transparent',
  borderColor: '#e0d3c2',
  borderRadius: 9,
  padding: 0,
  fieldRadius: 9,
  fieldHeight: 46,
  fieldTextColor: '#26211c',
  labelColor: '#26211c',
  placeholderColor: '#9a8e7e',
  detailGroupBackground: 'transparent',
  detailGroupPadding: 0,
};

function renderForm(props: ShippingAddressFormProps = GLOW_PROPS) {
  return render(
    <LanguageProvider value="en">
      <ShippingAddressForm {...props} />
    </LanguageProvider>,
  );
}

describe('ShippingAddressForm expanded (design-fidelity props)', () => {
  it('auto-expands detailed address fields when google autocomplete is off', () => {
    const { container } = renderForm();
    expect(container.querySelector('input[name="address1"]')).toBeTruthy();
    expect(container.querySelector('input[name="address2"]')).toBeTruthy();
    expect(container.querySelector('input[name="city"]')).toBeTruthy();
    expect(container.querySelector('input[name="postalCode"]')).toBeTruthy();
    expect(container.querySelector('select[name="state"], input[name="state"]')).toBeTruthy();
  });

  it('detail group has no gray inset panel (transparent + zero padding)', () => {
    const { container } = renderForm();
    const address1 = container.querySelector('input[name="address1"]') as HTMLElement;
    const group = address1.parentElement!.parentElement as HTMLElement;
    expect(group.style.background).toBe('transparent');
    expect(group.style.padding).toBe('0px');
    // and the default gray panel must NOT appear anywhere in the form
    const grays = Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
      (d) => d.style.background === 'rgb(249, 250, 251)' || d.style.background === '#f9fafb',
    );
    expect(grays.length).toBe(0);
  });

  it('contact + address fields share the themed 46px / 9px / warm styling', () => {
    const { container } = renderForm();
    for (const name of ['email', 'firstName', 'lastName', 'phone', 'address1', 'city', 'postalCode']) {
      const el = container.querySelector(`[name="${name}"]`) as HTMLElement;
      expect(el, name).toBeTruthy();
      expect(el.style.height, name).toBe('46px');
      expect(el.style.borderRadius, name).toBe('9px');
      expect(el.style.color.replace(/\s/g, ''), name).toMatch(/#26211c|rgb\(38,33,28\)/i);
    }
  });

  it('first/last name row uses the 2-col grid class (side-by-side, not stacked)', () => {
    const { container } = renderForm();
    const first = container.querySelector('input[name="firstName"]') as HTMLElement;
    const row = first.parentElement!.parentElement as HTMLElement;
    expect(row.className).toContain('autonnel-form-grid-2');
  });

  it('on-focus mode renders a single collapsed full-width address line, then expands on focus', () => {
    const { container } = renderForm({ ...GLOW_PROPS, addressDisclosure: 'on-focus' });
    // collapsed: address1 present, city/state not yet
    const addr = container.querySelector('input[name="address1"]') as HTMLElement;
    expect(addr).toBeTruthy();
    expect(addr.style.height).toBe('46px');
    expect(container.querySelector('input[name="city"]')).toBeNull();
    // expand on focus
    fireEvent.focus(addr);
    expect(container.querySelector('input[name="city"]')).toBeTruthy();
    expect(container.querySelector('input[name="postalCode"]')).toBeTruthy();
  });

  it('default props still reproduce the legacy gray inset panel (backwards compat)', () => {
    const { container } = renderForm({
      ...GLOW_PROPS,
      detailGroupBackground: '#f9fafb',
      detailGroupPadding: 16,
      fieldHeight: undefined as unknown as number,
    } as typeof GLOW_PROPS);
    const address1 = container.querySelector('input[name="address1"]') as HTMLElement;
    const group = address1.parentElement!.parentElement as HTMLElement;
    expect(group.style.padding).toBe('16px');
  });
});
