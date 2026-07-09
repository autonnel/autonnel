import { createElement } from 'react';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { islandLoaders } from './island-loaders';
import { LanguageProvider } from './LanguageContext';

type ComponentMap = Record<string, React.ComponentType<any>>;

async function loadIsland(type: string) {
  const loader = islandLoaders[type];
  if (!loader) {
    console.warn(`[AutonnelIslandHydrator] Missing loader for ${type}`);
    return null;
  }

  try {
    return await loader();
  } catch (error) {
    console.error(`[AutonnelIslandHydrator] Loader failed for ${type}`, error);
    return null;
  }
}

async function loadComponents(types: Set<string>): Promise<ComponentMap> {
  const map: ComponentMap = {};
  await Promise.all([...types].map(async (type) => {
    const Component = await loadIsland(type);
    if (Component) {
      map[type] = Component;
    }
  }));
  return map;
}

function collectIslandTypes(islands: HTMLElement[]) {
  const types = new Set<string>();
  for (const island of islands) {
    const type = island.getAttribute('data-island');
    if (type) types.add(type);
  }
  return types;
}

function readIslandProps(island: HTMLElement, type: string) {
  const propsScript = island.querySelector('script[data-island-props]');
  if (!propsScript) {
    console.warn(`[AutonnelIslandHydrator] Props script missing for ${type}`);
    return null;
  }

  try {
    return JSON.parse(propsScript.textContent || '{}') as Record<string, any>;
  } catch (error) {
    console.error(`[AutonnelIslandHydrator] Props parse failed for ${type}`, error);
    return null;
  }
}

function mountIsland(island: HTMLElement, Component: React.ComponentType<any>, props: Record<string, any>, language: string) {
  createRoot(island).render(
    createElement(LanguageProvider, { value: language }, createElement(Component, props)),
  );
}

async function hydrateIslands() {
  const islands = Array.from(document.querySelectorAll<HTMLElement>('[data-island]'));
  if (islands.length === 0) return;

  const components = await loadComponents(collectIslandTypes(islands));

  for (const island of islands) {
    const type = island.getAttribute('data-island');
    const Component = type ? components[type] : null;
    if (!type || !Component) continue;

    const props = readIslandProps(island, type);
    if (props) {
      mountIsland(island, Component, props, 'en');
    }
  }
}

export function IslandHydrator() {
  useEffect(() => {
    hydrateIslands();
  }, []);

  return null;
}
