import type { Page } from './types';

export function checkHasUnpublishedChanges(page: Page): boolean {
  if (page.status !== 'PUBLISHED') return false;
  if (page.editorType === 'HTML') {
    if (page.draftHtml === null && page.draftSettings === null) return false;
    const htmlChanged = page.draftHtml !== null && page.draftHtml !== page.htmlContent;
    const settingsChanged =
      page.draftSettings !== null &&
      JSON.stringify(page.draftSettings) !== JSON.stringify(page.settings);
    return htmlChanged || settingsChanged;
  }
  if (!page.draftData && !page.publishedData) return false;
  if (!page.draftData || !page.publishedData) return true;
  return JSON.stringify(page.draftData) !== JSON.stringify(page.publishedData);
}
