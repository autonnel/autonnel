import { describe, it, expect } from 'vitest';
import { getTemplateData, getTemplateByValue } from '@/lib/templates';

describe('ERROR template', () => {
  it('is registered as utility section with defaultPageType ERROR', () => {
    const t = getTemplateByValue('ERROR');
    expect(t).toBeDefined();
    expect(t!.section).toBe('utility');
    expect(t!.defaultPageType).toBe('ERROR');
  });

  it('generates a reassurance bar, hero, two-column retry section, FAQ and footer', () => {
    const data = getTemplateData('ERROR');
    const types = data.content.map((c: any) => c.type);
    expect(types).toEqual(['NoticeBar', 'ImageTextSplit', 'ColumnLayout', 'FaqAccordion', 'PageFooter']);
  });

  it('nests the payment retry form inside the retry column layout', () => {
    const data = getTemplateData('ERROR');
    const columns: any = data.content.find((c: any) => c.type === 'ColumnLayout');
    expect(columns).toBeDefined();
    const leftTypes = (columns.props.left as any[]).map((c) => c.type);
    expect(leftTypes).toContain('PaymentEntryForm');
    const retryForm = (columns.props.left as any[]).find((c) => c.type === 'PaymentEntryForm');
    expect(retryForm.props.buttonText).toBe('Retry Payment');
  });
});
