import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiSection } from '@/components/builder/MediaField/AiSection';

const baseProps = {
  mediaType: 'image' as const,
  onMediaTypeChange: vi.fn(),
  prompt: '',
  onPromptChange: vi.fn(),
  referenceImageUrl: '',
  onReferenceImageChange: vi.fn(),
  uploadReference: async () => {},
  uploadingReference: false,
  onGenerate: vi.fn(),
  generating: false,
  generatingType: null as 'image' | 'video' | null,
  error: '',
  generationAspectRatio: undefined as string | undefined,
  onGenerationAspectRatioChange: vi.fn(),
};

describe('AiSection', () => {
  it('renders type segment with image active by default', () => {
    render(<AiSection {...baseProps} />);
    expect((screen.getByRole('radio', { name: 'image' }) as HTMLInputElement).getAttribute('aria-checked')).toBe('true');
  });

  it('flips media type when video is clicked', () => {
    const onMediaTypeChange = vi.fn();
    render(<AiSection {...baseProps} onMediaTypeChange={onMediaTypeChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'video' }));
    expect(onMediaTypeChange).toHaveBeenCalledWith('video');
  });

  it('forwards prompt edits', () => {
    const onPromptChange = vi.fn();
    render(<AiSection {...baseProps} onPromptChange={onPromptChange} />);
    fireEvent.change(screen.getByPlaceholderText(/Describe/), { target: { value: 'x' } });
    expect(onPromptChange).toHaveBeenCalledWith('x');
  });

  it('disables Generate when prompt is empty', () => {
    render(<AiSection {...baseProps} />);
    expect((screen.getByRole('button', { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables Generate when prompt has content', () => {
    render(<AiSection {...baseProps} prompt="a cat" />);
    expect((screen.getByRole('button', { name: /Generate/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('calls onGenerate with current media type and prompt', () => {
    const onGenerate = vi.fn();
    render(<AiSection {...baseProps} prompt="a cat" onGenerate={onGenerate} mediaType="video" />);
    fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
    expect(onGenerate).toHaveBeenCalledWith('video', 'a cat');
  });

  it('renders the error line when error is set', () => {
    render(<AiSection {...baseProps} error="boom" />);
    expect(screen.getByText('boom')).toBeTruthy();
  });

  it('renders a Konjura button', () => {
    render(<AiSection {...baseProps} />);
    expect(screen.getByRole('button', { name: /Konjura/ })).toBeTruthy();
  });
});
