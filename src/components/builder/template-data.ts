import type { Data } from '@puckeditor/core';
import { getTemplateData as registryGetTemplateData } from '@/lib/templates';

export const getTemplateData = (templateType: string): Data => {
  return registryGetTemplateData(templateType);
};
