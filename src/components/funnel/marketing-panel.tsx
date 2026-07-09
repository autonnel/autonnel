import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import Modal from '../primitives/Modal';
import FormSelect from '../primitives/FormSelect';
import { Button as DsButton, Card as DsCard, Badge as DsBadge } from '../primitives/ds';

type AdPlatformType = 'FACEBOOK' | 'TIKTOK' | 'GOOGLE_ADS' | 'BING_ADS';

export interface AdPlatform {
  id: string;
  name: string;
  platform: AdPlatformType;
  isActive: boolean;
}

export interface AdBinding {
  id: string;
  adPlatformId: string;
  adPlatform: AdPlatform;
}

interface FunnelMarketingProps {
  funnelId: string;
  initialBindings: AdBinding[];
  availablePlatforms: AdPlatform[];
}

interface PlatformMeta {
  name: string;
  icon: React.ReactNode;
  color: string;
}

const PLATFORM_INFO: Record<AdPlatformType, PlatformMeta> = {
  FACEBOOK: {
    name: 'Facebook',
    color: '#1877F2',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  TIKTOK: {
    name: 'TikTok',
    color: '#111827',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1.04-.1z" />
      </svg>
    ),
  },
  GOOGLE_ADS: {
    name: 'Google Ads',
    color: '#4285F4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 19.5h6.5L12 13l3.5 6.5H22L12 2z" />
      </svg>
    ),
  },
  BING_ADS: {
    name: 'Bing Ads',
    color: '#008373',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 2v17.5l4.5 2.5 8.5-4.9v-4.3l-9 3.2 2.5-1.4V8.3L5 2z" />
      </svg>
    ),
  },
};

const GENERIC_PLATFORM_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 110 16 8 8 0 010-16z" />
  </svg>
);

function platformMeta(platform: string): PlatformMeta {
  return (
    PLATFORM_INFO[String(platform).toUpperCase() as AdPlatformType] ?? {
      name: platform || 'Ad platform',
      color: '#6b7280',
      icon: GENERIC_PLATFORM_ICON,
    }
  );
}

export default function FunnelMarketing(props: FunnelMarketingProps) {
  const { funnelId, initialBindings, availablePlatforms } = props;
  const [bindings, setBindings] = useState<AdBinding[]>(initialBindings);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [isBinding, setIsBinding] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  function openAddPlatform() {
    setSelectedPlatform('');
    setIsAddOpen(true);
  }

  function closeAddPlatform() {
    if (isBinding) return;
    setIsAddOpen(false);
    setSelectedPlatform('');
  }

  async function handleBind() {
    if (!selectedPlatform) return;
    setIsBinding(true);
    try {
      const res = await fetch(`/api/funnel/${funnelId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adPlatformId: selectedPlatform }),
      });
      if (res.ok) {
        const binding: AdBinding = await res.json();
        setBindings((prev) => [
          ...prev.filter((b) => b.adPlatform.platform !== binding.adPlatform.platform),
          binding,
        ]);
        setSelectedPlatform('');
        setIsAddOpen(false);
      } else {
        const error: { error?: string } = await res.json();
        alert(error.error || 'Failed to bind platform');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to bind platform');
    } finally {
      setIsBinding(false);
    }
  }

  async function handleUnbind(bindingId: string) {
    if (!confirm('Are you sure you want to remove this ad platform from the funnel?')) return;
    try {
      const res = await fetch(`/api/funnel/${funnelId}/ads`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindingId }),
      });
      if (res.ok) {
        setBindings((prev) => prev.filter((b) => b.id !== bindingId));
      } else {
        const error: { error?: string } = await res.json();
        alert(error.error || 'Failed to unbind platform');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to unbind platform');
    }
  }

  const boundPlatformTypes = bindings.map((b) => b.adPlatform.platform);
  const unboundPlatforms = availablePlatforms.filter(
    (p) => !boundPlatformTypes.includes(p.platform),
  );
  const canAdd = unboundPlatforms.length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[14px] font-semibold text-ds-ink">Ad platform bindings</div>
          <div className="text-[12.5px] text-ds-muted mt-0.5">
            Bind ad accounts to this funnel. Conversions will be sent to all bound platforms when an
            order completes.
          </div>
        </div>
        {canAdd && (
          <DsButton variant="primary" onClick={openAddPlatform}>
            + Add platform
          </DsButton>
        )}
      </div>

      <DsCard
        title="Bound platforms"
        subtitle={`${bindings.length} active binding${bindings.length === 1 ? '' : 's'}`}
      >
        {bindings.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-ds-surface2 border border-ds-line flex items-center justify-center">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ds-muted"
              >
                <path
                  d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="text-[13px] text-ds-ink font-medium">No platforms bound</div>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {bindings.map((binding) => {
              const info = platformMeta(binding.adPlatform.platform);
              return (
                <div
                  key={binding.id}
                  className="flex items-center justify-between gap-3 bg-ds-surface2 border border-ds-line rounded-[10px] p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0"
                      style={{ backgroundColor: info.color + '15', color: info.color }}
                    >
                      {info.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ds-ink truncate">
                        {binding.adPlatform.name}
                      </div>
                      <div className="text-[11.5px] text-ds-muted">{info.name}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnbind(binding.id)}
                    className="inline-flex items-center justify-center rounded-[7px] h-7 px-2.5 text-[12px] bg-ds-card border border-ds-badBorder text-ds-bad hover:bg-[#FEF2F2]"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DsCard>

      {isAddOpen && (
        <Modal
          isOpen={isAddOpen}
          onClose={closeAddPlatform}
          title="Add platform"
          description="Pick from your configured ad platforms."
          maxWidth="md"
        >
          <FormSelect
            label="Platform"
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
          >
            <option value="">Select a platform to add</option>
            {unboundPlatforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({platformMeta(p.platform).name})
              </option>
            ))}
          </FormSelect>

          <div className="flex gap-2 justify-end mt-6">
            <DsButton onClick={closeAddPlatform} disabled={isBinding}>
              Cancel
            </DsButton>
            <DsButton
              variant="primary"
              onClick={handleBind}
              disabled={!selectedPlatform || isBinding}
              leftIcon={isBinding ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
            >
              Bind platform
            </DsButton>
          </div>
        </Modal>
      )}

      <DsCard padded>
        <div className="flex gap-3">
          <DsBadge tone="muted">Info</DsBadge>
          <p className="text-[12.5px] text-ds-slate">
            When a customer completes a purchase through this funnel, conversion events are sent to
            every bound platform for attribution.
          </p>
        </div>
      </DsCard>
    </div>
  );
}
