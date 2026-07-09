import { describe, expect, it } from 'vitest';
import { resolveGenerationParams } from '../generation';
import type { MediaFieldValue } from '../index';

const baseValue: MediaFieldValue = { url: '', prompt: '', mediaType: 'image' };

describe('resolveGenerationParams', () => {
  it('uses the fallback when generationAspectRatio is undefined', () => {
    const { effectiveAspectRatio } = resolveGenerationParams(baseValue, '4:5');
    expect(effectiveAspectRatio).toBe('4:5');
  });

  it('uses generationAspectRatio when set', () => {
    const v = { ...baseValue, generationAspectRatio: '16:9' };
    const { effectiveAspectRatio } = resolveGenerationParams(v, '4:5');
    expect(effectiveAspectRatio).toBe('16:9');
  });

  it('updates displayRatio and switches displaySizeMode to "ratio" when mode is undefined', () => {
    const { updatedValue } = resolveGenerationParams(baseValue, '4:5');
    expect(updatedValue.displaySizeMode).toBe('ratio');
    expect(updatedValue.displayRatio).toBe('4:5');
  });

  it('updates displayRatio when displaySizeMode is "ratio"', () => {
    const v: MediaFieldValue = { ...baseValue, displaySizeMode: 'ratio', displayRatio: '1:1' };
    const { updatedValue } = resolveGenerationParams(v, '16:9');
    expect(updatedValue.displaySizeMode).toBe('ratio');
    expect(updatedValue.displayRatio).toBe('16:9');
  });

  it('updates displayRatio but keeps displaySizeMode "original"', () => {
    const v: MediaFieldValue = { ...baseValue, displaySizeMode: 'original', displayRatio: '1:1' };
    const { updatedValue } = resolveGenerationParams(v, '16:9');
    expect(updatedValue.displaySizeMode).toBe('original');
    expect(updatedValue.displayRatio).toBe('16:9');
  });

  it('leaves displaySizeMode, displayRatio, displayWidth, displayHeight untouched when "custom"', () => {
    const v: MediaFieldValue = {
      ...baseValue,
      displaySizeMode: 'custom',
      displayRatio: '1:1',
      displayWidth: 320,
      displayHeight: 200,
    };
    const { updatedValue } = resolveGenerationParams(v, '16:9');
    expect(updatedValue.displaySizeMode).toBe('custom');
    expect(updatedValue.displayRatio).toBe('1:1');
    expect(updatedValue.displayWidth).toBe(320);
    expect(updatedValue.displayHeight).toBe(200);
  });

  it('returns a new value object (does not mutate input)', () => {
    const v = { ...baseValue };
    const { updatedValue } = resolveGenerationParams(v, '4:5');
    expect(updatedValue).not.toBe(v);
  });
});
