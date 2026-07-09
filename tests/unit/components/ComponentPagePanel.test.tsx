// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import ComponentPagePanel from '@/components/page-create/ComponentPagePanel';

describe('ComponentPagePanel', () => {
  it('creates a PUCK page from the selected template', async () => {
    const onCreated = vi.fn();
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: 'page-1', name: 'Landing Page · Skincare' }),
    } as any)) as any;
    render(
      <ComponentPagePanel
        onCancel={() => {}}
        onBack={() => {}}
        onCreated={onCreated}
        redirectAfterCreate={false}
      />,
    );

    fireEvent.click(screen.getByText('Landing Page · Skincare'));
    fireEvent.click(screen.getByText('Create Page'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/page', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"editorType":"PUCK"'),
      }));
      expect(onCreated).toHaveBeenCalledWith({ id: 'page-1', name: 'Landing Page · Skincare' });
    });
  });
});
