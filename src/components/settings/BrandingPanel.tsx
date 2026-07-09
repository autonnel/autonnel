import React, { useRef, useState } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Button as DsButton, Card as DsCard } from '../primitives/ds';
import { FormInput, AlertBox } from '../primitives';
import { apiCall } from '@/lib/api/client';
import type { FaviconJson, LogoJson } from '@/lib/branding/types';

interface BrandingPanelProps {
  initial: {
    name: string;
    favicon: FaviconJson | null;
    logo: LogoJson | null;
  };
}

const FAVICON_PREVIEW_SIZES: { key: keyof FaviconJson['variants']; label: string; px: number }[] = [
  { key: 'favicon-16x16.png', label: '16', px: 16 },
  { key: 'favicon-32x32.png', label: '32', px: 32 },
  { key: 'apple-touch-icon.png', label: '180', px: 48 },
  { key: 'android-chrome-192x192.png', label: '192', px: 56 },
  { key: 'android-chrome-512x512.png', label: '512', px: 64 },
];

export default function BrandingPanel({ initial }: BrandingPanelProps) {
  const [name, setName] = useState(initial.name);
  const [favicon, setFavicon] = useState<FaviconJson | null>(initial.favicon);
  const [logo, setLogo] = useState<LogoJson | null>(initial.logo);

  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  const [faviconBusy, setFaviconBusy] = useState(false);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconSaved, setFaviconSaved] = useState(false);

  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSaved, setLogoSaved] = useState(false);

  const faviconInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const saveName = async () => {
    setSavingName(true);
    setNameError(null);
    try {
      await apiCall('PUT /api/settings/branding', { name });
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingName(false);
    }
  };

  const uploadFavicon = async (file: File) => {
    setFaviconBusy(true);
    setFaviconError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/branding/favicon', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as FaviconJson & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setFavicon(data);
      setFaviconSaved(true);
      setTimeout(() => setFaviconSaved(false), 2000);
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setFaviconBusy(false);
      if (faviconInputRef.current) faviconInputRef.current.value = '';
    }
  };

  const removeFavicon = async () => {
    setFaviconBusy(true);
    setFaviconError(null);
    try {
      const res = await fetch('/api/settings/branding/favicon', { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setFavicon(null);
    } catch (err) {
      setFaviconError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setFaviconBusy(false);
    }
  };

  const uploadLogo = async (file: File) => {
    setLogoBusy(true);
    setLogoError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/settings/branding/logo', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => ({}))) as LogoJson & { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setLogo(data);
      setLogoSaved(true);
      setTimeout(() => setLogoSaved(false), 2000);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLogoBusy(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    setLogoBusy(true);
    setLogoError(null);
    try {
      const res = await fetch('/api/settings/branding/logo', { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setLogo(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : 'Remove failed');
    } finally {
      setLogoBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-[12.5px] text-ds-muted">
        Display name, favicon and logo used in customer-facing pages.
      </div>

      <DsCard>
        <div className="flex flex-col gap-3">
          <div className="text-[13px] font-semibold text-ds-ink">Name</div>
          {nameError && <AlertBox type="error">{nameError}</AlertBox>}
          <FormInput
            label=""
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Workspace"
          />
          <div className="flex items-center gap-3">
            <DsButton variant="primary" onClick={saveName} disabled={savingName}>
              {savingName && <Loader2 className="h-4 w-4 animate-spin" />}
              Save name
            </DsButton>
            {nameSaved && <span className="text-[12.5px] text-ds-okText">Saved</span>}
          </div>
        </div>
      </DsCard>

      <DsCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-ds-ink">Favicon</div>
              <div className="text-[12px] text-ds-muted mt-0.5">
                PNG, JPEG, WebP or SVG. Max 2 MB. We auto-generate 5 size variants.
              </div>
            </div>
            {faviconSaved && <span className="text-[12.5px] text-ds-okText">Uploaded</span>}
          </div>
          {faviconError && <AlertBox type="error">{faviconError}</AlertBox>}

          <div className="flex items-center gap-3">
            <input
              ref={faviconInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFavicon(f);
              }}
            />
            <DsButton
              variant="default"
              disabled={faviconBusy}
              onClick={() => faviconInputRef.current?.click()}
              leftIcon={faviconBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {favicon ? 'Replace favicon' : 'Upload favicon'}
            </DsButton>
            {favicon && (
              <DsButton
                variant="ghost"
                disabled={faviconBusy}
                onClick={removeFavicon}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Remove
              </DsButton>
            )}
          </div>

          {favicon && (
            <div className="flex flex-wrap items-end gap-4 pt-1">
              {FAVICON_PREVIEW_SIZES.map((s) => {
                const url = favicon.variants?.[s.key];
                if (!url) return null;
                return (
                  <div key={s.key} className="flex flex-col items-center gap-1">
                    <div
                      className="border border-ds-line rounded-[6px] bg-[#F9FAFB] flex items-center justify-center"
                      style={{ width: Math.max(s.px + 8, 32), height: Math.max(s.px + 8, 32) }}
                    >
                      <img
                        src={url}
                        alt={s.label}
                        style={{ width: s.px, height: s.px, objectFit: 'contain' }}
                      />
                    </div>
                    <div className="text-[11px] text-ds-muted">{s.label}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DsCard>

      <DsCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-semibold text-ds-ink">Logo</div>
              <div className="text-[12px] text-ds-muted mt-0.5">
                PNG, JPEG, WebP or SVG. Max 5 MB.
              </div>
            </div>
            {logoSaved && <span className="text-[12.5px] text-ds-okText">Uploaded</span>}
          </div>
          {logoError && <AlertBox type="error">{logoError}</AlertBox>}

          <div className="flex items-center gap-3">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadLogo(f);
              }}
            />
            <DsButton
              variant="default"
              disabled={logoBusy}
              onClick={() => logoInputRef.current?.click()}
              leftIcon={logoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            >
              {logo ? 'Replace logo' : 'Upload logo'}
            </DsButton>
            {logo && (
              <DsButton
                variant="ghost"
                disabled={logoBusy}
                onClick={removeLogo}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Remove
              </DsButton>
            )}
          </div>

          {logo?.url && (
            <div className="border border-ds-line rounded-[6px] bg-[#F9FAFB] p-3 inline-flex">
              <img src={logo.url} alt="Logo" style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain' }} />
            </div>
          )}
        </div>
      </DsCard>
    </div>
  );
}
