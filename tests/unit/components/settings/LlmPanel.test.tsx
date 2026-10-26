// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LlmPanel from '@/components/settings/LlmPanel';

describe('LlmPanel add drawer', () => {
  it.each([
    ['Image', 'image', 'OpenAI Images'],
    ['Video', 'video', 'OpenAI Video (Sora)'],
    ['Text', 'text', 'OpenAI Chat Completions'],
  ])('opens with the type of the table whose Add button was clicked (%s)', async (label, type, provider) => {
    render(<LlmPanel initialModels={[]} />);
    fireEvent.click(screen.getByRole('button', { name: `+ Add ${label} Model` }));

    await waitFor(() => expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe(type));
    const providerSelect = screen.getByLabelText('Provider') as HTMLSelectElement;
    expect(providerSelect.selectedOptions[0].textContent).toBe(provider);
  });
});
