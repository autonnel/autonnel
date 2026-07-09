import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReferenceImage } from '@/components/builder/MediaField/ReferenceImage';

describe('ReferenceImage', () => {
  it('renders the add trigger when collapsed and value is empty', () => {
    render(<ReferenceImage value="" onChange={() => {}} onUpload={async () => {}} uploading={false} disabled={false} />);
    expect(screen.getByRole('button', { name: /Add reference image/i })).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Paste URL/i)).toBeNull();
  });

  it('auto-expands when value is non-empty on mount', () => {
    render(<ReferenceImage value="https://cdn/r.png" onChange={() => {}} onUpload={async () => {}} uploading={false} disabled={false} />);
    expect((screen.getByRole('img', { name: 'Reference' }) as HTMLImageElement).src).toBe('https://cdn/r.png');
  });

  it('clicking add trigger expands the input', () => {
    render(<ReferenceImage value="" onChange={() => {}} onUpload={async () => {}} uploading={false} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Add reference image/i }));
    expect(screen.getByPlaceholderText(/Paste URL/i)).toBeTruthy();
  });

  it('Remove clears the value and collapses', () => {
    const onChange = vi.fn();
    render(<ReferenceImage value="https://cdn/r.png" onChange={onChange} onUpload={async () => {}} uploading={false} disabled={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
