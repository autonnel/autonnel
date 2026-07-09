import type { IPage } from 'easy-email-core';
import { EmailTemplateType } from '../types';
import type { Bundle, SupportedLanguage, TemplateBundles } from './_types';
import { orderReceiptDesign } from '../designs/order-receipt';
import { shippedDesign } from '../designs/shipped';
import { orderDeliveredDesign } from '../designs/order-delivered';
import { refundDesign } from '../designs/refund';
import { recall1Design } from '../designs/recall-1';
import { recall2Design } from '../designs/recall-2';
import { recall3Design } from '../designs/recall-3';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { de } from './locales/de';
import { es } from './locales/es';

const LANGS: SupportedLanguage[] = ['en', 'fr', 'de', 'es'];
const locales = { en, fr, de, es };

function compose(type: EmailTemplateType, design: IPage): Bundle {
  const names = {} as Record<SupportedLanguage, string>;
  const subjects = {} as Record<SupportedLanguage, string>;
  const texts = {} as Record<SupportedLanguage, Record<string, string>>;
  for (const lang of LANGS) {
    names[lang] = locales[lang][type].name;
    subjects[lang] = locales[lang][type].subject;
    texts[lang] = locales[lang][type].texts;
  }
  return { design, names, subjects, texts };
}

export const TEMPLATE_BUNDLES: TemplateBundles = {
  [EmailTemplateType.ORDER_RECEIPT]: compose(EmailTemplateType.ORDER_RECEIPT, orderReceiptDesign),
  [EmailTemplateType.ORDER_SHIPPED]: compose(EmailTemplateType.ORDER_SHIPPED, shippedDesign),
  [EmailTemplateType.ORDER_DELIVERED]: compose(EmailTemplateType.ORDER_DELIVERED, orderDeliveredDesign),
  [EmailTemplateType.ORDER_REFUNDED]: compose(EmailTemplateType.ORDER_REFUNDED, refundDesign),
  [EmailTemplateType.RECALL_1]: compose(EmailTemplateType.RECALL_1, recall1Design),
  [EmailTemplateType.RECALL_2]: compose(EmailTemplateType.RECALL_2, recall2Design),
  [EmailTemplateType.RECALL_3]: compose(EmailTemplateType.RECALL_3, recall3Design),
};

export type { Bundle, SupportedLanguage } from './_types';
