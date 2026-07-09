import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_REGISTRY,
  getTemplateByValue,
  getTemplatesBySection,
  getTemplateData,
} from '@/lib/templates';

describe('template registry', () => {
  it('exports a non-mutable TEMPLATE_REGISTRY array', () => {
    expect(Array.isArray(TEMPLATE_REGISTRY)).toBe(true);
  });

  it('getTemplateByValue returns undefined for unknown value', () => {
    expect(getTemplateByValue('__nope__')).toBeUndefined();
  });

  it('getTemplatesBySection returns an array', () => {
    expect(Array.isArray(getTemplatesBySection('funnel'))).toBe(true);
    expect(Array.isArray(getTemplatesBySection('store'))).toBe(true);
    expect(Array.isArray(getTemplatesBySection('utility'))).toBe(true);
  });

  it('getTemplateData returns empty Puck Data shape for unknown templateType', () => {
    const data = getTemplateData('__nope__');
    expect(data).toHaveProperty('root');
    expect(data).toHaveProperty('content');
    expect(data).toHaveProperty('zones');
    expect(Array.isArray(data.content)).toBe(true);
  });
});
