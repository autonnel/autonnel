import { describe, it, expect } from 'vitest';
import { MessageTemplate } from './message-template';
import { ChannelType, TemplateKey } from './value-objects';
import { VariableSchema } from './variable-schema';

function template() {
  return MessageTemplate.create({
    tenantId: 'default',
    templateKey: TemplateKey.of('order.receipt'),
  });
}

const schema = VariableSchema.of([
  { name: 'orderNumber', required: true },
  { name: 'firstName', required: false },
]);

describe('MessageTemplate.addDraft', () => {
  it('adds a draft version bound to one channel', () => {
    const t = template();
    const v = t.addDraft({
      channel: ChannelType.EMAIL,
      locale: 'en',
      subject: 'Receipt #{{orderNumber}}',
      html: '<p>Hi {{firstName}}, order {{orderNumber}}</p>',
      text: 'order {{orderNumber}}',
      schema,
    });
    expect(v.channel).toBe(ChannelType.EMAIL);
    expect(v.isPublished).toBe(false);
  });

  it('rejects a draft whose body references an undeclared variable', () => {
    const t = template();
    expect(() =>
      t.addDraft({
        channel: ChannelType.EMAIL,
        locale: 'en',
        subject: 'Receipt',
        html: '<p>{{undeclaredVar}}</p>',
        text: 'x',
        schema,
      }),
    ).toThrow(/undeclared variable.*undeclaredVar/i);
  });
});

describe('MessageTemplate.publish', () => {
  it('publishing a draft supersedes any previously published version for the same (key, channel)', () => {
    const t = template();
    const v1 = t.addDraft({ channel: ChannelType.EMAIL, locale: 'en', subject: 's1', html: '<p>{{orderNumber}}</p>', text: 't', schema });
    t.publish(v1.versionId);
    const v2 = t.addDraft({ channel: ChannelType.EMAIL, locale: 'en', subject: 's2', html: '<p>{{orderNumber}}</p>', text: 't', schema });
    t.publish(v2.versionId);
    expect(t.currentPublished(ChannelType.EMAIL, 'en')?.versionId).toBe(v2.versionId);
    expect(t.findVersion(v1.versionId)?.isPublished).toBe(true); // historical, kept, immutable
  });

  it('a published version is immutable (editing requires a new draft)', () => {
    const t = template();
    const v = t.addDraft({ channel: ChannelType.EMAIL, locale: 'en', subject: 's', html: '<p>{{orderNumber}}</p>', text: 't', schema });
    t.publish(v.versionId);
    expect(() => t.editDraft(v.versionId, { subject: 'changed' })).toThrow(/immutable|published/i);
  });

  it('currentPublished is locale-aware', () => {
    const t = template();
    const en = t.addDraft({ channel: ChannelType.EMAIL, locale: 'en', subject: 'en', html: '<p>{{orderNumber}}</p>', text: 't', schema });
    const fr = t.addDraft({ channel: ChannelType.EMAIL, locale: 'fr', subject: 'fr', html: '<p>{{orderNumber}}</p>', text: 't', schema });
    t.publish(en.versionId);
    t.publish(fr.versionId);
    expect(t.currentPublished(ChannelType.EMAIL, 'fr')?.subject).toBe('fr');
    expect(t.currentPublished(ChannelType.EMAIL, 'en')?.subject).toBe('en');
  });
});
