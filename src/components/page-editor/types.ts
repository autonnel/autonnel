import type { Data } from '@puckeditor/core';

export interface PageMeta {
  title?: string;
  description?: string;
}

export interface Page {
  id: string;
  name: string;
  slug: string;
  type: string;
  editorType: string;
  status: string;
  draftData: Data | null;
  publishedData: Data | null;
  htmlContent: string | null;
  draftHtml: string | null;
  draftSettings: Record<string, any> | null;
  planContent: any;
  meta: PageMeta | null;
  settings: Record<string, any> | null;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface PageEditorProps {
  page: Page;
  products: any[];
  user: User | null;
}

export type SaveStatus = 'saving' | 'saved' | 'error';

export interface SettingsPanelProps {
  pageName: string;
  setPageName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  slugError: string;
  setSlugError: (v: string) => void;
  meta: PageMeta;
  setMeta: (v: PageMeta) => void;
  showCustomScripts: boolean;
  headContent: string;
  setHeadContent: (v: string) => void;
  bodyScripts: string;
  setBodyScripts: (v: string) => void;
  settingsSaveState: 'idle' | 'saving' | 'saved';
  onSave: () => void;
  embedded?: boolean;
}
