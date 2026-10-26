import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Funnel, FunnelPage } from './types';

vi.mock('../page-create/CreatePageModal', () => ({
  default: ({ defaultPageType }: { defaultPageType?: string }) => (
    <div data-testid="create-page-modal">{defaultPageType}</div>
  ),
}));

import FunnelSteps from './steps-panel';

const thankYouStep: FunnelPage = {
  id: 'fp-ty', pageId: 'p-ty', pageType: 'THANKYOU', order: 0, subOrder: 0, stepSlug: 'thank-you', nextUrl: null,
  page: { id: 'p-ty', name: 'Thank You', slug: 'thank-you', type: 'THANKYOU', status: 'PUBLISHED' },
};
const landingStep: FunnelPage = {
  id: 'fp-lp', pageId: 'p-lp', pageType: 'LANDING', order: 1, subOrder: 0, stepSlug: 'lp', nextUrl: null,
  page: { id: 'p-lp', name: 'LP', slug: 'lp', type: 'CUSTOM', status: 'DRAFT' },
};

function funnelWith(pages: FunnelPage[]): Funnel {
  return { id: 'f1', name: 'F', slug: 'f', description: null, createdAt: '', updatedAt: '', pages };
}

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

describe('FunnelSteps landing guidance', () => {
  it('prompts for a landing page when the funnel has none', () => {
    render(<FunnelSteps funnel={funnelWith([thankYouStep])} allPages={[]} />);
    expect(screen.getByTestId('funnel-next-step-landing').textContent).toContain('Next step: add a landing page');
    expect(screen.queryByTestId('create-page-modal')).toBeNull();
  });

  it('opens the template picker for a landing page right after funnel creation', () => {
    window.history.replaceState(null, '', '/funnel/f1/pages?next=landing');
    render(<FunnelSteps funnel={funnelWith([thankYouStep])} allPages={[]} />);
    expect(screen.getByTestId('create-page-modal').textContent).toBe('CUSTOM');
    expect(window.location.search).toBe('');
  });

  it('shows no prompt once a landing page is bound', () => {
    window.history.replaceState(null, '', '/funnel/f1/pages?next=landing');
    render(<FunnelSteps funnel={funnelWith([landingStep, thankYouStep])} allPages={[]} />);
    expect(screen.queryByTestId('funnel-next-step-landing')).toBeNull();
    expect(screen.queryByTestId('create-page-modal')).toBeNull();
  });
});
