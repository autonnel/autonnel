import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { MediaFieldComponent, type MediaFieldValue } from '@/components/builder/MediaField/index';

const renderField = (initial: Partial<MediaFieldValue> = {}, overrides: Record<string, unknown> = {}) => {
  const value: MediaFieldValue = { url: '', prompt: '', mediaType: 'image', ...initial };
  const onChange = vi.fn((v: MediaFieldValue) => Object.assign(value, v));
  return {
    onChange,
    ...render(
      <MediaFieldComponent
        value={value}
        onChange={onChange}
        planId="plan_test"
        fieldName="img"
        fieldId={`field-${Math.random()}`}
        {...overrides}
      />
    ),
  };
};

beforeEach(() => {
  window.localStorage.clear();
  (window as unknown as { __mediaGenerationStateStore?: Map<string, unknown> }).__mediaGenerationStateStore = new Map();
  (window as unknown as { __mediaGenerationStateListeners?: Map<string, Set<() => void>> }).__mediaGenerationStateListeners = new Map();
});

describe('MediaFieldComponent layout', () => {
  it('renders preview, source row, and the AI toggle button', () => {
    renderField();
    expect(screen.getByPlaceholderText(/Media URL/)).toBeTruthy();
    expect(screen.getByLabelText(/Upload image or video/)).toBeTruthy();
    expect(screen.getByLabelText(/Toggle AI generation/)).toBeTruthy();
  });

  it('hides the AI section by default when there is no prompt', () => {
    renderField();
    expect(screen.queryByRole('radiogroup', { name: 'Media type' })).toBeNull();
  });

  it('auto-expands the AI section when prompt is preset', () => {
    renderField({ prompt: 'preset' });
    expect(screen.getByRole('radiogroup', { name: 'Media type' })).toBeTruthy();
  });

  it('toggles the AI section on ✦ click', () => {
    renderField();
    fireEvent.click(screen.getByLabelText(/Toggle AI generation/));
    expect(screen.getByRole('radiogroup', { name: 'Media type' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Toggle AI generation/));
    expect(screen.queryByRole('radiogroup', { name: 'Media type' })).toBeNull();
  });

  it('renders the display-size chip with Auto when no size is set', () => {
    renderField();
    expect(screen.getByRole('button', { name: /Display size: Auto/ })).toBeTruthy();
  });

  it('lets the user close the AI section even when a prompt is set', () => {
    renderField({ prompt: 'existing prompt' });
    expect(screen.getByRole('radiogroup', { name: 'Media type' })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/Toggle AI generation/));
    expect(screen.queryByRole('radiogroup', { name: 'Media type' })).toBeNull();
  });
});
