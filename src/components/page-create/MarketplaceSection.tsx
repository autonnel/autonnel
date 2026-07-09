import { useEffect, useState } from 'react';
import { ExternalLink, Store, LayoutTemplate, Loader2 } from 'lucide-react';
import {
  fetchMarketplaceTemplatePacks,
  getMarketplaceProductUrl,
  type MarketplaceTemplatePack,
} from '@/lib/marketplace/public-catalog';
import { MARKETPLACE_SECTION_META } from './shared';

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}

export default function MarketplaceSection() {
  const [packs, setPacks] = useState<MarketplaceTemplatePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchMarketplaceTemplatePacks(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPacks(result);
        setFailed(result.length === 0);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  // Silent-hide when offline / empty so OSS page creation never depends on the network.
  if (!loading && (failed || packs.length === 0)) return null;

  return (
    <div data-testid="marketplace-section" className="mb-6 last:mb-0">
      <div className="sticky top-0 bg-ds-card z-10 pb-2 border-b border-ds-line mb-3">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-ds-slate" aria-hidden="true" />
          <h3 className="text-[13px] font-semibold text-ds-ink">{MARKETPLACE_SECTION_META.title}</h3>
          <span className="inline-flex items-center rounded-full bg-ds-surface2 text-ds-slate text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
            Premium
          </span>
          {!loading && (
            <span className="text-ds-muted font-normal text-[12px]">({packs.length})</span>
          )}
        </div>
        <p className="text-[11.5px] text-ds-muted mt-0.5">{MARKETPLACE_SECTION_META.subtitle}</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-ds-muted py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading marketplace…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {packs.map((pack) => (
            <button
              key={pack.slug}
              type="button"
              data-testid="marketplace-card"
              data-slug={pack.slug}
              onClick={() =>
                window.open(getMarketplaceProductUrl(pack.slug), '_blank', 'noopener')
              }
              className="group rounded-[10px] border border-ds-line bg-ds-card transition-all cursor-pointer overflow-hidden text-left hover:border-ds-slate"
            >
              <div className="aspect-[4/5] bg-ds-surface2 flex items-center justify-center overflow-hidden relative">
                {pack.heroImage ? (
                  <img
                    src={`${pack.heroImage}`}
                    alt={pack.title}
                    className="w-full h-full object-cover object-top"
                    loading="lazy"
                  />
                ) : (
                  <LayoutTemplate className="w-10 h-10 text-ds-faint" aria-hidden="true" />
                )}
                <span className="absolute top-1.5 right-1.5 inline-flex items-center justify-center w-5 h-5 rounded-[6px] bg-ds-card/90 text-ds-slate opacity-0 group-hover:opacity-100 transition-opacity">
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </span>
              </div>
              <div className="p-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="text-[12.5px] font-medium text-ds-ink line-clamp-1">
                    {pack.title}
                  </div>
                  <div className="text-[12px] font-semibold text-ds-ink shrink-0">
                    {formatPrice(pack.priceCents)}
                  </div>
                </div>
                {pack.tagline && (
                  <div className="text-[11.5px] text-ds-muted mt-0.5 line-clamp-2">
                    {pack.tagline}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
