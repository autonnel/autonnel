import type { IPage } from 'easy-email-core';
import type { EmailTemplateType } from '../types';

export type SupportedLanguage = 'en' | 'fr' | 'de' | 'es';

export interface Bundle {
  design: IPage;
  names: Record<SupportedLanguage, string>;
  subjects: Record<SupportedLanguage, string>;
  texts: Record<SupportedLanguage, Record<string, string>>;
}

export type TemplateBundles = Record<EmailTemplateType, Bundle>;

export interface LocaleContent {
  name: string;
  subject: string;
  texts: Record<string, string>;
}

export type LocaleBundles = Record<EmailTemplateType, LocaleContent>;
