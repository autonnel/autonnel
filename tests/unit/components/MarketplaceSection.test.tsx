// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import MarketplaceSection from '@/components/page-create/MarketplaceSection';

const PACKS = [
  { slug: 'atelier', title: 'Atelier', tagline: 'Luxury fragrance', category: 'Beauty', priceCents: 5900, heroImage: '/h/atelier.svg', npmPackage: '@autonnel/template-atelier' },
  { slug: 'bloom', title: 'Bloom', tagline: 'Wellness gummies', category: 'Wellness', priceCents: 5900, heroImage: '/h/bloom.svg', npmPackage: '@autonnel/template-bloom' },
  { slug: 'glow', title: 'Glow', tagline: 'Skincare', category: 'Beauty', priceCents: 5900, heroImage: '/h/glow.svg', npmPackage: '@autonnel/template-glow' },
  { slug: 'meridian', title: 'Meridian', tagline: 'Coffee', category: 'F&B', priceCents: 5900, heroImage: '/h/meridian.svg', npmPackage: '@autonnel/template-meridian' },
  { slug: 'riot', title: 'Riot', tagline: 'Hot sauce', category: 'F&B', priceCents: 5900, heroImage: '/h/riot.svg', npmPackage: '@autonnel/template-riot' },
  { slug: 'volt', title: 'Volt', tagline: 'Recovery tech', category: 'Tech', priceCents: 5900, heroImage: '/h/volt.svg', npmPackage: '@autonnel/template-volt' },
];

function mockCatalog(items: unknown) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ generatedAt: 'now', items }),
  })) as any;
}

const ORIGINAL_FETCH = global.fetch;
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  openSpy = vi.fn();
  vi.stubGlobal('open', openSpy);
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MarketplaceSection', () => {
  it('renders the 6 template packs as deep-link cards under a Marketplace + Premium header', async () => {
    mockCatalog(PACKS);
    render(<MarketplaceSection />);

    await waitFor(() => {
      expect(screen.getAllByTestId('marketplace-card')).toHaveLength(6);
    });
    expect(screen.getByText('Marketplace')).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
    PACKS.forEach((p) => expect(screen.getByText(p.title)).toBeTruthy());
  });

  it('opens the website product page in a new tab with noopener on card click', async () => {
    mockCatalog(PACKS);
    render(<MarketplaceSection />);

    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(6));
    const atelier = screen.getAllByTestId('marketplace-card').find((b) => b.getAttribute('data-slug') === 'atelier')!;
    fireEvent.click(atelier);

    expect(openSpy).toHaveBeenCalledWith(
      'https://autonnel.com/marketplace/atelier',
      '_blank',
      'noopener',
    );
  });

  it('cards are plain buttons (type=button) — never a submit, never a template selection', async () => {
    mockCatalog(PACKS);
    render(<MarketplaceSection />);
    await waitFor(() => expect(screen.getAllByTestId('marketplace-card')).toHaveLength(6));
    screen.getAllByTestId('marketplace-card').forEach((btn) => {
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  it('silently hides (renders nothing) when the catalog is empty', async () => {
    mockCatalog([]);
    const { container } = render(<MarketplaceSection />);
    await waitFor(() => {
      expect(screen.queryByTestId('marketplace-section')).toBeNull();
    });
    expect(container.querySelector('[data-testid="marketplace-card"]')).toBeNull();
  });

  it('silently hides when the fetch fails (offline)', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('offline');
    }) as any;
    render(<MarketplaceSection />);
    await waitFor(() => {
      expect(screen.queryByTestId('marketplace-section')).toBeNull();
    });
  });
});
