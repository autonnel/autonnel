// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { getTemplatesBySection } from '@/lib/templates';

describe('CreatePageModal data source', () => {
  it('registry has 8 funnel / 0 store / 3 utility', () => {
    expect(getTemplatesBySection('funnel')).toHaveLength(8);
    expect(getTemplatesBySection('store')).toHaveLength(0);
    expect(getTemplatesBySection('utility')).toHaveLength(3);
  });

  it('funnel templates carry PNG thumbnails', () => {
    const funnels = getTemplatesBySection('funnel');
    for (const t of funnels) {
      expect(t.thumbnail).toBeTruthy();
      expect(t.thumbnail).toMatch(/\.png$/);
    }
  });

  it('utility templates carry PNG thumbnails', () => {
    const utility = getTemplatesBySection('utility');
    for (const t of utility) {
      expect(t.thumbnail).toBeTruthy();
      expect(t.thumbnail).toMatch(/\.png$/);
    }
  });

  it('CreatePageModal module imports without throwing', { timeout: 15000 }, async () => {
    const mod = await import('@/components/page-create/CreatePageModal');
    expect(typeof mod.default).toBe('function');
  });
});

import { render, fireEvent, screen } from '@testing-library/react';
import CreatePageModal from '@/components/page-create/CreatePageModal';

describe('CreatePageModal — Step 1 chooser', () => {
  it('renders two editor cards by default', () => {
    render(<CreatePageModal onClose={() => {}} onCreated={() => {}} />);
    expect(screen.getByTestId('editor-card-PUCK')).toBeTruthy();
    expect(screen.getByTestId('editor-card-HTML')).toBeTruthy();
  });

  it('clicking a card advances to the matching panel', () => {
    render(<CreatePageModal onClose={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByTestId('editor-card-PUCK'));
    expect(screen.getByTestId('component-page-panel')).toBeTruthy();
  });

  it('back button returns to Step 1', () => {
    render(<CreatePageModal onClose={() => {}} onCreated={() => {}} />);
    fireEvent.click(screen.getByTestId('editor-card-HTML'));
    fireEvent.click(screen.getByTestId('panel-back'));
    expect(screen.getByTestId('editor-card-PUCK')).toBeTruthy();
  });

  it('chooser cards have a title and at least three bullets each', () => {
    render(<CreatePageModal onClose={() => {}} onCreated={() => {}} />);
    for (const choice of ['PUCK', 'HTML']) {
      const card = screen.getByTestId(`editor-card-${choice}`);
      expect(card.querySelectorAll('li').length).toBeGreaterThanOrEqual(3);
    }
  });
});
