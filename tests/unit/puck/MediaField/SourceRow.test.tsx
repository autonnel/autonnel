import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SourceRow } from '@/components/builder/MediaField/SourceRow';

describe('SourceRow', () => {
  it('renders the URL value', () => {
    render(
      <SourceRow
        url="https://cdn/x.png"
        onUrlChange={() => {}}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen={false}
        onAiToggle={() => {}}
        generating={false}
        hasUnsentPrompt={false}
      />
    );
    expect((screen.getByPlaceholderText(/Media URL/) as HTMLInputElement).value).toBe('https://cdn/x.png');
  });

  it('forwards URL edits', () => {
    const onUrlChange = vi.fn();
    render(
      <SourceRow
        url=""
        onUrlChange={onUrlChange}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen={false}
        onAiToggle={() => {}}
        generating={false}
        hasUnsentPrompt={false}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Media URL/), { target: { value: 'a' } });
    expect(onUrlChange).toHaveBeenCalledWith('a');
  });

  it('renders the unsent-prompt dot when hasUnsentPrompt is true and AI is closed', () => {
    render(
      <SourceRow
        url=""
        onUrlChange={() => {}}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen={false}
        onAiToggle={() => {}}
        generating={false}
        hasUnsentPrompt
      />
    );
    expect(screen.getByTestId('ai-unsent-dot')).toBeTruthy();
  });

  it('does not render the dot when AI is open', () => {
    render(
      <SourceRow
        url=""
        onUrlChange={() => {}}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen
        onAiToggle={() => {}}
        generating={false}
        hasUnsentPrompt
      />
    );
    expect(screen.queryByTestId('ai-unsent-dot')).toBeNull();
  });

  it('AI toggle is disabled while generating', () => {
    render(
      <SourceRow
        url=""
        onUrlChange={() => {}}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen
        onAiToggle={() => {}}
        generating
        hasUnsentPrompt={false}
      />
    );
    expect((screen.getByLabelText(/Toggle AI generation/) as HTMLButtonElement).disabled).toBe(true);
  });

  it('fires onAiToggle when clicked', () => {
    const onAiToggle = vi.fn();
    render(
      <SourceRow
        url=""
        onUrlChange={() => {}}
        onUploadClick={() => {}}
        uploading={false}
        aiOpen={false}
        onAiToggle={onAiToggle}
        generating={false}
        hasUnsentPrompt={false}
      />
    );
    fireEvent.click(screen.getByLabelText(/Toggle AI generation/));
    expect(onAiToggle).toHaveBeenCalled();
  });
});
