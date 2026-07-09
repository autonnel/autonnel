// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AiSection } from '../AiSection';

function renderAiSection(overrides: Partial<React.ComponentProps<typeof AiSection>> = {}) {
  const props: React.ComponentProps<typeof AiSection> = {
    mediaType: 'image',
    onMediaTypeChange: vi.fn(),
    prompt: '',
    onPromptChange: vi.fn(),
    referenceImageUrl: '',
    onReferenceImageChange: vi.fn(),
    uploadReference: vi.fn().mockResolvedValue(undefined),
    uploadingReference: false,
    onGenerate: vi.fn(),
    generating: false,
    generatingType: null,
    error: '',
    generationAspectRatio: undefined,
    onGenerationAspectRatioChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AiSection {...props} />) };
}

describe('AiSection ratio row', () => {
  it('renders Auto + 6 chips when mediaType is image', () => {
    renderAiSection({ mediaType: 'image' });
    for (const label of ['Auto', '1:1', '4:5', '4:3', '3:4', '16:9', '9:16']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
  });

  it('renders Auto + 3 chips when mediaType is video (filters 4:5, 4:3, 3:4)', () => {
    renderAiSection({ mediaType: 'video' });
    for (const label of ['Auto', '1:1', '16:9', '9:16']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
    for (const label of ['4:5', '4:3', '3:4']) {
      expect(screen.queryByRole('radio', { name: label })).toBeNull();
    }
  });

  it('marks Auto as active when generationAspectRatio is undefined', () => {
    renderAiSection({ generationAspectRatio: undefined });
    expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('true');
  });

  it('marks the matching chip as active when generationAspectRatio is set', () => {
    renderAiSection({ generationAspectRatio: '16:9' });
    expect(screen.getByRole('radio', { name: '16:9' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Auto' }).getAttribute('aria-checked')).toBe('false');
  });

  it('calls onGenerationAspectRatioChange("4:5") when user clicks "4:5"', async () => {
    const onChange = vi.fn();
    renderAiSection({ onGenerationAspectRatioChange: onChange });
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: '4:5' }));
    expect(onChange).toHaveBeenCalledWith('4:5');
  });

  it('calls onGenerationAspectRatioChange(undefined) when user clicks Auto', async () => {
    const onChange = vi.fn();
    renderAiSection({ generationAspectRatio: '16:9', onGenerationAspectRatioChange: onChange });
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: 'Auto' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('resets to Auto when switching from image to video while a video-incompatible ratio is selected', async () => {
    const onGenChange = vi.fn();
    const { rerender, props } = renderAiSection({
      mediaType: 'image',
      generationAspectRatio: '4:5',
      onGenerationAspectRatioChange: onGenChange,
    });
    rerender(<AiSection {...props} mediaType="video" />);
    expect(onGenChange).toHaveBeenCalledWith(undefined);
  });

  it('does NOT reset when switching to video while a video-compatible ratio is selected', () => {
    const onGenChange = vi.fn();
    const { rerender, props } = renderAiSection({
      mediaType: 'image',
      generationAspectRatio: '16:9',
      onGenerationAspectRatioChange: onGenChange,
    });
    rerender(<AiSection {...props} mediaType="video" />);
    expect(onGenChange).not.toHaveBeenCalled();
  });

  it('disables all chips while generating', () => {
    renderAiSection({ generating: true });
    for (const label of ['Auto', '1:1', '4:5']) {
      expect((screen.getByRole('radio', { name: label }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});
