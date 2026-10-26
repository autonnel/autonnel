import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import Button from './Button';

// A bare <button> defaults to type="submit" in HTML. Any Button rendered inside a <form> without
// an explicit type (e.g. a toolbar action next to a filter form) would otherwise submit that form
// on click instead of running its own onClick handler -- see AdsRefreshButton's regression test
// for the concrete failure this caused.
describe('Button', () => {
  it('defaults to type="button" instead of the HTML native submit default', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' }) as HTMLButtonElement;
    expect(btn.type).toBe('button');
  });

  it('still allows a caller to opt into type="submit" explicitly', () => {
    render(<Button type="submit">Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(btn.type).toBe('submit');
  });
});
