import { describe, it, expect } from 'vitest';
import { MediaGridConfig } from '@/components/builder/blocks/MediaGrid';

describe('MediaGridConfig', () => {
  it('exposes columns as a number field (2-6)', () => {
    const cols = (MediaGridConfig.fields as any).columns;
    expect(cols.type).toBe('number');
    expect(cols.min).toBe(2);
    expect(cols.max).toBe(6);
  });

  it('exposes aspectRatio as a radio with 4 options', () => {
    const ar = (MediaGridConfig.fields as any).aspectRatio;
    expect(ar.type).toBe('radio');
    const values = ar.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['1:1', '4:5', '16:9', '3:4']));
  });

  it('exposes tiles as an array with tile-type variants', () => {
    const tiles = (MediaGridConfig.fields as any).tiles;
    expect(tiles.type).toBe('array');
    expect(tiles.arrayFields).toBeDefined();
    expect(tiles.arrayFields.tileType).toBeDefined();
  });

  it('default columns is 4 and default aspectRatio is 1:1', () => {
    expect(MediaGridConfig.defaultProps.columns).toBe(4);
    expect(MediaGridConfig.defaultProps.aspectRatio).toBe('1:1');
  });
});
