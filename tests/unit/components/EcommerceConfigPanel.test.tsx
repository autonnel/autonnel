// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import EcommerceConfigPanel from '@/components/settings/EcommerceConfigPanel';

const APP_URL = 'https://shopify-helper.example.com';

function baseInitial() {
  return {
    hasConfig: false,
    provider: 'SHOPIFY' as const,
    fulfillmentMode: 'merged' as const,
    shopify: { shopDomain: '', apiVersion: '2025-01', disableNotifications: true },
    woo: { siteUrl: '', apiVersion: 'wc/v3' },
    picocart: { baseUrl: '', apiVersion: '2024-01' },
  };
}

function postFromApp(data: unknown, origin: string) {
  window.dispatchEvent(new MessageEvent('message', { data, origin }));
}

describe('EcommerceConfigPanel Shopify connect', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a Connect button when a connect app URL is provided', () => {
    render(<EcommerceConfigPanel initial={baseInitial()} shopifyConnectAppUrl={APP_URL} />);
    expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
  });

  it('hides the Connect button when no connect app URL is provided', () => {
    render(<EcommerceConfigPanel initial={baseInitial()} shopifyConnectAppUrl="" />);
    expect(screen.queryByRole('button', { name: 'Connect' })).toBeNull();
  });

  it('fills Shop Domain and Access Token from a valid postMessage', async () => {
    render(<EcommerceConfigPanel initial={baseInitial()} shopifyConnectAppUrl={APP_URL} />);
    postFromApp(
      { source: 'autonnel-shopify-connect', shop: 'demo.myshopify.com', accessToken: 'shpat_demo123', scope: 'read_products' },
      APP_URL,
    );
    await waitFor(() => {
      expect((screen.getByLabelText('Shop Domain') as HTMLInputElement).value).toBe('demo.myshopify.com');
      expect((screen.getByLabelText('Access Token') as HTMLInputElement).value).toBe('shpat_demo123');
    });
  });

  it('ignores a message from the wrong origin', async () => {
    render(<EcommerceConfigPanel initial={baseInitial()} shopifyConnectAppUrl={APP_URL} />);
    postFromApp(
      { source: 'autonnel-shopify-connect', shop: 'evil.myshopify.com', accessToken: 'shpat_evil', scope: '' },
      'https://evil.com',
    );
    await new Promise((r) => setTimeout(r, 30));
    expect((screen.getByLabelText('Access Token') as HTMLInputElement).value).toBe('');
  });

  it('ignores a message with the wrong source', async () => {
    render(<EcommerceConfigPanel initial={baseInitial()} shopifyConnectAppUrl={APP_URL} />);
    postFromApp(
      { source: 'something-else', shop: 'x.myshopify.com', accessToken: 'shpat_x', scope: '' },
      APP_URL,
    );
    await new Promise((r) => setTimeout(r, 30));
    expect((screen.getByLabelText('Access Token') as HTMLInputElement).value).toBe('');
  });
});
