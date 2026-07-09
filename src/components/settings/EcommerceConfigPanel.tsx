import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';
import { FormInput, FormSelect, AlertBox, Radio, Checkbox, dsFieldLabelClass } from '../primitives';
import { apiCall, ApiCallError } from '@/lib/api/client';

type Provider = 'SHOPIFY' | 'WOOCOMMERCE' | 'PICOCART';
type FulfillmentMode = 'merged' | 'split';

const PROVIDER_LABEL: Record<Provider, string> = {
  SHOPIFY: 'Shopify',
  WOOCOMMERCE: 'WooCommerce',
  PICOCART: 'Picocart',
};

interface EcommerceConfigPanelProps {
  initial: {
    hasConfig: boolean;
    provider: Provider;
    fulfillmentMode: FulfillmentMode;
    shopify: { shopDomain: string; apiVersion: string; disableNotifications: boolean };
    woo: { siteUrl: string; apiVersion: string };
    picocart: { baseUrl: string; apiVersion: string };
  };
  shopifyConnectAppUrl?: string;
}

export default function EcommerceConfigPanel({ initial, shopifyConnectAppUrl = '' }: EcommerceConfigPanelProps) {
  const [provider, setProvider] = useState<Provider>(initial.provider);
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>(initial.fulfillmentMode);
  const [shopify, setShopify] = useState({
    shopDomain: initial.shopify.shopDomain,
    apiVersion: initial.shopify.apiVersion,
    accessToken: '',
    disableNotifications: initial.shopify.disableNotifications,
  });
  const [woo, setWoo] = useState({
    siteUrl: initial.woo.siteUrl,
    apiVersion: initial.woo.apiVersion,
    consumerKey: '',
    consumerSecret: '',
  });
  const [picocart, setPicocart] = useState({
    baseUrl: initial.picocart.baseUrl,
    apiVersion: initial.picocart.apiVersion,
    apiKey: '',
  });
  const [hasConfig, setHasConfig] = useState(initial.hasConfig);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [resyncing, setResyncing] = useState(false);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [connectedShop, setConnectedShop] = useState<string | null>(null);

  const showForm = !hasConfig || editing;

  const appOrigin = useMemo(() => {
    if (!shopifyConnectAppUrl) return '';
    try {
      return new URL(shopifyConnectAppUrl).origin;
    } catch {
      return '';
    }
  }, [shopifyConnectAppUrl]);

  useEffect(() => {
    if (!appOrigin) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== appOrigin) return;
      const d = e.data as { source?: string; shop?: string; accessToken?: string };
      if (!d || d.source !== 'autonnel-shopify-connect' || typeof d.accessToken !== 'string') return;
      const shopDomain = typeof d.shop === 'string' ? d.shop : '';
      setShopify(prev => ({ ...prev, shopDomain: shopDomain || prev.shopDomain, accessToken: d.accessToken as string }));
      setConnectedShop(shopDomain);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [appOrigin]);

  const handleConnect = () => {
    if (!shopifyConnectAppUrl) return;
    const base = shopifyConnectAppUrl.replace(/\/$/, '');
    const returnOrigin = encodeURIComponent(window.location.origin);
    const url = shopify.shopDomain
      ? `${base}/install?shop=${encodeURIComponent(shopify.shopDomain)}&return_origin=${returnOrigin}`
      : `${base}/?return_origin=${returnOrigin}`;
    window.open(url, 'autonnel-shopify-connect', 'width=520,height=720');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const credentials =
        provider === 'SHOPIFY' ? shopify
          : provider === 'WOOCOMMERCE' ? woo
          : picocart;
      await apiCall('PUT /api/ecommerce/config', { provider, credentials, fulfillmentMode });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setHasConfig(true);
      setEditing(false);
      void handleResync();
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleResync = async () => {
    setResyncing(true);
    setError(null);
    setResyncMsg(null);
    try {
      const result = await apiCall('POST /api/ecommerce/resync', null);
      setResyncMsg(`Synced ${result.synced} product${result.synced === 1 ? '' : 's'} from ${PROVIDER_LABEL[provider]}.`);
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Resync failed');
    } finally {
      setResyncing(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove the ecommerce configuration?')) return;
    setRemoving(true);
    setError(null);
    try {
      await apiCall('DELETE /api/ecommerce/config', null);
      setHasConfig(false);
      setEditing(false);
      setShopify(s => ({ ...s, accessToken: '' }));
      setWoo(w => ({ ...w, consumerKey: '', consumerSecret: '' }));
      setPicocart(p => ({ ...p, apiKey: '' }));
    } catch (err) {
      setError(err instanceof ApiCallError || err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setRemoving(false);
    }
  };

  const summaryRows: Array<{ label: string; value: string }> = (() => {
    if (provider === 'SHOPIFY') {
      return [
        { label: 'Store domain', value: shopify.shopDomain || '—' },
        { label: 'API version', value: shopify.apiVersion || '—' },
        { label: 'Customer notifications', value: shopify.disableNotifications ? 'Handled by autonnel' : 'Sent by Shopify' },
      ];
    }
    if (provider === 'WOOCOMMERCE') {
      return [
        { label: 'Site URL', value: woo.siteUrl || '—' },
        { label: 'API version', value: woo.apiVersion || '—' },
      ];
    }
    return [
      { label: 'Base URL', value: picocart.baseUrl || '—' },
      { label: 'API version', value: picocart.apiVersion || '—' },
    ];
  })();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-[12.5px] text-ds-muted">Connect Shopify, WooCommerce or Picocart for product and order data.</div>
        <div className="text-[12.5px] text-ds-muted mt-2 leading-relaxed">
          The platform is used only to host product and order data. Recall, shipping, tax, coupons,
          email templates and other business logic are configured in this system&apos;s Settings —
          equivalent settings on the ecommerce platform are not read or synced.
        </div>
      </div>
      {error && <AlertBox type="error">{error}</AlertBox>}

      {!showForm ? (
        <DsCard>
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px] font-semibold text-ds-ink">{PROVIDER_LABEL[provider]}</span>
                <DsBadge tone="ok">Configured</DsBadge>
                <DsBadge tone="muted">{fulfillmentMode === 'split' ? 'Split' : 'Merged'} fulfillment</DsBadge>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DsButton variant="default" onClick={handleResync} disabled={resyncing}>
                  {resyncing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Resync products
                </DsButton>
                <DsButton variant="default" onClick={() => setEditing(true)}>Edit</DsButton>
                <DsButton variant="default" onClick={handleRemove} disabled={removing}>
                  {removing && <Loader2 className="h-4 w-4 animate-spin" />}
                  Remove
                </DsButton>
              </div>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {summaryRows.map(row => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <dt className="text-[11.5px] uppercase tracking-wide text-ds-muted">{row.label}</dt>
                  <dd className="text-[13px] text-ds-text break-all">{row.value}</dd>
                </div>
              ))}
            </dl>
            <div className="text-[12px] text-ds-muted leading-relaxed">
              Products shown in the page builder come from a local cache that refreshes periodically.
              Use Resync to pull the latest products right after connecting or changing your store.
            </div>
            {resyncMsg && <div className="text-[12.5px] text-ds-okText">{resyncMsg}</div>}
          </div>
        </DsCard>
      ) : (
        <DsCard>
          <div className="flex flex-col gap-4">
            <FormSelect label="Provider" value={provider} onChange={e => setProvider(e.target.value as Provider)}>
              <option value="SHOPIFY">Shopify</option>
              <option value="WOOCOMMERCE">WooCommerce</option>
              <option value="PICOCART">Picocart</option>
            </FormSelect>

            <div className="flex flex-col gap-2">
              <label className={dsFieldLabelClass}>Fulfillment Mode</label>
              <div className="flex flex-col gap-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Radio
                    name="fulfillmentMode"
                    value="merged"
                    checked={fulfillmentMode === 'merged'}
                    onChange={() => setFulfillmentMode('merged')}
                    className="mt-1"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-ds-text">Merged</span>
                    <span className="text-[12px] text-ds-muted leading-relaxed">
                      One external order per checkout (main + accepted upsells combined). Best when
                      fulfillment platform ships from one warehouse.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Radio
                    name="fulfillmentMode"
                    value="split"
                    checked={fulfillmentMode === 'split'}
                    onChange={() => setFulfillmentMode('split')}
                    className="mt-1"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[13px] text-ds-text">Split</span>
                    <span className="text-[12px] text-ds-muted leading-relaxed">
                      Each upsell pushed as its own external order, linked via tag. Use when upsells
                      ship from different suppliers (dropship).
                    </span>
                  </span>
                </label>
              </div>
              {provider !== 'SHOPIFY' && (
                <div className="text-[11.5px] text-ds-muted leading-relaxed">
                  {provider === 'WOOCOMMERCE'
                    ? 'WooCommerce customer email behavior is controlled by the WooCommerce store settings; this app does not toggle it.'
                    : 'Picocart is the commerce backend built into Autonnel and does not send customer emails; Autonnel sends them for you.'}
                </div>
              )}
            </div>

            {provider === 'SHOPIFY' && (
              <>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormInput label="Shop Domain" value={shopify.shopDomain} onChange={e => setShopify({ ...shopify, shopDomain: e.target.value })} placeholder="my-store.myshopify.com" />
                  </div>
                  {shopifyConnectAppUrl && (
                    <DsButton variant="default" onClick={handleConnect} className="shrink-0">Connect</DsButton>
                  )}
                </div>
                {connectedShop && (
                  <div className="text-[12px] text-ds-okText">
                    Connected to {connectedShop} — click Save to store the token.
                  </div>
                )}
                <FormInput label="API Version" value={shopify.apiVersion} onChange={e => setShopify({ ...shopify, apiVersion: e.target.value })} />
                <FormInput label="Access Token" type="password" value={shopify.accessToken} onChange={e => setShopify({ ...shopify, accessToken: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'shpat_...'} />
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={shopify.disableNotifications}
                    onChange={e => setShopify({ ...shopify, disableNotifications: e.target.checked })}
                    className="mt-1"
                  />
                  <span className="text-[13px] text-ds-text">Disable Shopify customer notifications</span>
                </label>
                {shopify.disableNotifications && (
                  <AlertBox type="warning">
                    Shopify customer emails are disabled. Order receipt, shipping, delivery, refund and recall emails will be sent by autonnel instead. Configure Settings → Email Provider; otherwise customers will not receive any emails.
                  </AlertBox>
                )}
              </>
            )}

            {provider === 'WOOCOMMERCE' && (
              <>
                <FormInput label="Site URL" value={woo.siteUrl} onChange={e => setWoo({ ...woo, siteUrl: e.target.value })} placeholder="https://my-store.com" />
                <FormInput label="API Version" value={woo.apiVersion} onChange={e => setWoo({ ...woo, apiVersion: e.target.value })} />
                <FormInput label="Consumer Key" type="password" value={woo.consumerKey} onChange={e => setWoo({ ...woo, consumerKey: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'ck_...'} />
                <FormInput label="Consumer Secret" type="password" value={woo.consumerSecret} onChange={e => setWoo({ ...woo, consumerSecret: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'cs_...'} />
              </>
            )}

            {provider === 'PICOCART' && (
              <>
                <FormInput label="Base URL" value={picocart.baseUrl} onChange={e => setPicocart({ ...picocart, baseUrl: e.target.value })} placeholder="https://commerce.example.com" />
                <FormInput label="API Version" value={picocart.apiVersion} onChange={e => setPicocart({ ...picocart, apiVersion: e.target.value })} />
                <FormInput label="API Key" type="password" value={picocart.apiKey} onChange={e => setPicocart({ ...picocart, apiKey: e.target.value })} placeholder={hasConfig ? 'Leave blank to keep' : 'API key from Picocart Settings'} />
              </>
            )}

            <div className="flex items-center gap-3">
              <DsButton variant="primary" onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </DsButton>
              {hasConfig && editing && (
                <DsButton variant="default" onClick={() => { setEditing(false); setError(null); }} disabled={saving}>
                  Cancel
                </DsButton>
              )}
              {saved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
            </div>
          </div>
        </DsCard>
      )}
    </div>
  );
}
