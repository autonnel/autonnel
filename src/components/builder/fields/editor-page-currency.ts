import { createContext, useContext } from 'react';

// Fed by the editor shell so field components never import the Puck runtime,
// which would pull it into the storefront worker bundle.
export const EditorPageCurrencyContext = createContext('');

export function useEditorPageCurrency(): string {
  return useContext(EditorPageCurrencyContext);
}

export function normalizePageCurrency(value: unknown): string {
  return typeof value === 'string' ? value.toUpperCase() : '';
}
