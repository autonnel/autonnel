// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import HtmlPagePanel from '@/components/page-create/HtmlPagePanel';

function mockFetchSequence(responses: Array<{ status?: number; body: any }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const queue = [...responses];
  global.fetch = vi.fn(async (url: any, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const next = queue.shift();
    if (!next) throw new Error(`Unexpected fetch to ${url}`);
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      json: async () => next.body,
    } as any;
  }) as any;
  return calls;
}

beforeEach(() => {
  // jsdom does not implement navigation; stub redirect target.
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { href: '' },
  });
});

describe('HtmlPagePanel — Clone Webpage', () => {
  it('runs create → import → save in sequence', async () => {
    const calls = mockFetchSequence([
      { body: { id: 'p1' } },                       // POST /api/page
      { body: { html: '<p>imported</p>', replacements: 2, tier: 'fetch' } }, // import-html
      { body: { id: 'p1' } },                       // PUT /api/page/p1
    ]);

    render(
      <HtmlPagePanel
        onCancel={() => {}}
        onBack={() => {}}
        onCreated={() => {}}
        redirectAfterCreate={false}
      />,
    );

    // Switch to Clone Webpage tab
    fireEvent.click(screen.getByText('Clone Webpage'));

    // Fill fields. Use the input parts of the labels.
    fireEvent.change(screen.getByLabelText('Source URL'), {
      target: { value: 'https://example.com/lp' },
    });
    fireEvent.change(screen.getByLabelText('Page Name'), {
      target: { value: 'Imported LP' },
    });

    fireEvent.click(screen.getByText('Clone & Create'));

    await waitFor(() => expect(calls.length).toBe(3));

    expect(calls[0].url).toBe('/api/page');
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({
      type: 'custom',
      editorType: 'HTML',
    });

    expect(calls[1].url).toBe('/api/page/p1/import-html');
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({
      url: 'https://example.com/lp',
    });

    expect(calls[2].url).toBe('/api/page/p1');
    expect(calls[2].init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[2].init?.body))).toEqual({
      htmlContent: '<p>imported</p>',
    });
  });

  it('keeps the page and shows a warning when import fails', async () => {
    mockFetchSequence([
      { body: { id: 'p2' } },                     // POST /api/page  — succeeds
      { status: 400, body: { error: 'Source returned HTTP 404' } }, // import fails
    ]);

    const onCreated = vi.fn();
    render(
      <HtmlPagePanel
        onCancel={() => {}}
        onBack={() => {}}
        onCreated={onCreated}
        redirectAfterCreate={false}
      />,
    );

    fireEvent.click(screen.getByText('Clone Webpage'));
    fireEvent.change(screen.getByLabelText('Source URL'), {
      target: { value: 'https://example.com/missing' },
    });
    fireEvent.change(screen.getByLabelText('Page Name'), {
      target: { value: 'Broken LP' },
    });
    fireEvent.click(screen.getByText('Clone & Create'));

    await waitFor(() =>
      expect(screen.getByText(/Import did not complete/i)).toBeTruthy(),
    );
    expect(onCreated).toHaveBeenCalledWith({ id: 'p2' });
  });

  it('rejects invalid URL without calling fetch', async () => {
    const calls = mockFetchSequence([]);

    render(
      <HtmlPagePanel
        onCancel={() => {}}
        onBack={() => {}}
        onCreated={() => {}}
        redirectAfterCreate={false}
      />,
    );

    fireEvent.click(screen.getByText('Clone Webpage'));
    fireEvent.change(screen.getByLabelText('Source URL'), {
      target: { value: 'not-a-url' },
    });
    fireEvent.change(screen.getByLabelText('Page Name'), {
      target: { value: 'Bad URL' },
    });
    // Submit the form directly: jsdom enforces HTML5 constraint validation on
    // <input type="url" required>, which would block a click-based submit
    // before our handler runs. fireEvent.submit bypasses that and exercises
    // the component's own URL check.
    fireEvent.submit(screen.getByText('Clone & Create').closest('form')!);

    await waitFor(() => expect(screen.getByText(/valid http\(s\) URL/i)).toBeTruthy());
    expect(calls.length).toBe(0);
  });
});
