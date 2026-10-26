import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DiffCell, ConflictTooltip, formatMoney, formatRoas, nullableCount } from './ad-diff-cells';
import { computeDiff } from '@/lib/stats/ad-reconciliation';

describe('nullableCount', () => {
  it('renders null as a dash, never as zero', () => {
    expect(nullableCount(null)).toBe('-');
    expect(nullableCount(0)).toBe('0');
  });
});

describe('formatMoney', () => {
  it('formats minor units in the given currency', () => {
    expect(formatMoney(129900, 'USD')).toContain('1,299');
  });

  it('falls back gracefully for an unknown currency code', () => {
    expect(formatMoney(100, 'not-a-currency')).toContain('not-a-currency');
  });
});

describe('formatRoas', () => {
  it('divides revenue by spend', () => {
    expect(formatRoas(400000, 100000)).toBe('4.00x');
  });

  it('renders a dash instead of dividing by zero spend', () => {
    expect(formatRoas(400000, 0)).toBe('-');
  });
});

describe('DiffCell', () => {
  it('renders platform / onsite values and a severity-colored diff', () => {
    const diff = computeDiff({ metric: 'clicks', platform: 100, onsite: 40 });
    render(<DiffCell platform={100} onsite={40} diff={diff} />);
    expect(screen.getByText(/100/)).toBeTruthy();
    expect(screen.getByText(/40/)).toBeTruthy();
  });

  it('renders "Not compared" instead of a zero or blank when diff is null', () => {
    render(<DiffCell platform={5000} onsite={null} diff={null} unavailableNote="currency mismatch" />);
    expect(screen.getByText('Not compared')).toBeTruthy();
  });

  it('renders a dash for onsite when onsite is null but a diff exists (PLATFORM_ZERO style gaps)', () => {
    const diff = computeDiff({ metric: 'clicks', platform: 100, onsite: 0 });
    const { container } = render(<DiffCell platform={100} onsite={null} diff={diff} />);
    expect(container.textContent).toContain('100 / -');
  });

  it('formats money cells using the given currency', () => {
    const diff = computeDiff({ metric: 'revenueMinor', platform: 500000, onsite: 480000 });
    render(<DiffCell platform={500000} onsite={480000} diff={diff} currency="EUR" />);
    expect(screen.getByText(/5,000|5000/)).toBeTruthy();
  });
});

describe('ConflictTooltip', () => {
  it('puts dynamic reasons before the static methodology notes in the tooltip text', () => {
    render(
      <ConflictTooltip reasons={[{ code: 'FAILED_POSTBACKS', detail: 'Custom reason detail' }]}>
        <span>trigger</span>
      </ConflictTooltip>,
    );
    const el = screen.getByTitle((content) => content.startsWith('Custom reason detail'));
    expect(el.getAttribute('title')).toContain('Platform attribution windows');
  });

  it('still shows the static notes when there are no dynamic reasons', () => {
    render(
      <ConflictTooltip reasons={[]}>
        <span>trigger</span>
      </ConflictTooltip>,
    );
    const el = screen.getByText('trigger').closest('span[title]');
    expect(el?.getAttribute('title')).toContain('Platform attribution windows');
  });
});
