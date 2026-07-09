// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { URLFieldComponent, getURLString } from '@/components/builder/URLField';

describe('URLFieldComponent', () => {
  beforeEach(() => {
    delete (window as any).__FUNNEL_CTA_URL__;
    delete (window as any).__FUNNEL_NEXT_STEP_URL__;
  });

  it('normalizes string values and forwards custom URL edits', () => {
    const onChange = vi.fn();
    render(<URLFieldComponent value="/checkout" onChange={onChange} label="Button URL" />);

    expect(screen.getByText('Button URL')).toBeTruthy();
    const input = screen.getByPlaceholderText('Enter URL') as HTMLInputElement;
    expect(input.value).toBe('/checkout');

    fireEvent.change(input, { target: { value: '/upsell' } });
    expect(onChange).toHaveBeenCalledWith({ type: 'custom', url: '/upsell' });
  });

  it('emits funnel CTA mode without a static URL', () => {
    const onChange = vi.fn();
    render(<URLFieldComponent value={{ type: 'custom', url: '/checkout' }} onChange={onChange} />);

    fireEvent.click(screen.getByText('Funnel CTA Link'));
    expect(onChange).toHaveBeenCalledWith({ type: 'funnel-cta', url: '' });
    expect(screen.queryByPlaceholderText('Enter URL')).toBeNull();
  });

  it('resolves funnel CTA URLs from runtime globals', () => {
    (window as any).__FUNNEL_CTA_URL__ = '/next-step';
    expect(getURLString({ type: 'funnel-cta', url: '' })).toBe('/next-step');
  });
});
