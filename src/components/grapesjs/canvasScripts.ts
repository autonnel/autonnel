export const SCRIPTS_ON_KEY = 'autonnel:gjs:scripts-on';

export function getInitialScriptsOn(pageId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`${SCRIPTS_ON_KEY}:${pageId}`) === '1';
}

export function persistScriptsOn(pageId: string, on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  const key = `${SCRIPTS_ON_KEY}:${pageId}`;
  if (on) localStorage.setItem(key, '1');
  else localStorage.removeItem(key);
}
