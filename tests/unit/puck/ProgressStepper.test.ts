import { describe, it, expect } from 'vitest';
import { StepProgressConfig } from '@/components/builder/blocks/StepProgress';

describe('StepProgressConfig', () => {
  it('exposes orientation as a radio with horizontal/vertical', () => {
    const orient = (StepProgressConfig.fields as any).orientation;
    expect(orient.type).toBe('radio');
    const values = orient.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['horizontal', 'vertical']));
  });

  it('exposes stepStyle as a radio with numbered/dot/icon', () => {
    const ss = (StepProgressConfig.fields as any).stepStyle;
    expect(ss.type).toBe('radio');
    const values = ss.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['numbered', 'dot', 'icon']));
  });

  it('exposes connectorStyle as a radio with solid/dashed', () => {
    const cs = (StepProgressConfig.fields as any).connectorStyle;
    expect(cs.type).toBe('radio');
    const values = cs.options.map((o: any) => o.value);
    expect(values).toEqual(expect.arrayContaining(['solid', 'dashed']));
  });

  it('exposes currentStep as a number field', () => {
    const cs = (StepProgressConfig.fields as any).currentStep;
    expect(cs.type).toBe('number');
  });

  it('default orientation is horizontal and stepStyle is numbered', () => {
    expect(StepProgressConfig.defaultProps.orientation).toBe('horizontal');
    expect(StepProgressConfig.defaultProps.stepStyle).toBe('numbered');
  });
});
