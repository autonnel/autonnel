import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Render } from '@puckeditor/core/rsc';
import type { Config, Data } from '@puckeditor/core';
import { INTERACTIVE_COMPONENTS } from '@/components/builder/interactive-components';
import { puckConfig } from '@/components/builder/config';
import { LivePricingProvider } from '@/components/builder/live-pricing';
import { applyPuckDefaults } from '@/lib/puck/apply-default-props';

type PuckComponentConfig = Record<string, any>;

function staticMarkup(config: Config, data: Data) {
  return renderToStaticMarkup(createElement(Render, {
    config: config as any,
    data: applyPuckDefaults(data, puckConfig as Config),
  }));
}

// markResolved is set for the static (no-hydration) render path: the thank-you page never
// hydrates, so OrderDetailPanel must settle server-side — render the order if found, otherwise
// the empty state — instead of an initial loading spinner that would freeze forever.
function withOrderDetailsData(data: Data, ssrOrderData?: any, markResolved = false): Data {
  if (!ssrOrderData && !markResolved) return data;

  const cloned = typeof structuredClone === 'function'
    ? structuredClone(data)
    : JSON.parse(JSON.stringify(data));

  for (const block of cloned.content || []) {
    if (block.type === 'OrderDetailPanel') {
      if (ssrOrderData) block.props._ssrOrder = ssrOrderData;
      if (markResolved) block.props._ssrResolved = true;
    }
  }

  return cloned;
}

function serializedPropsScript(props: any) {
  return createElement('script', {
    type: 'application/json',
    'data-island-props': true,
    dangerouslySetInnerHTML: {
      __html: JSON.stringify(props).replace(/</g, '\\u003c'),
    },
  });
}

// Island markup is what the buyer sees until hydration, so it renders in live-pricing mode
// (loading state) instead of flashing the prices stored at edit time.
function islandRenderer(componentName: string, renderComponent: (props: any) => any, livePricing: boolean) {
  return function RenderIsland(props: any) {
    return createElement(
      'div',
      { 'data-island': componentName, 'data-island-id': props.id || '' },
      createElement(LivePricingProvider, { value: livePricing }, createElement(renderComponent, props)),
      serializedPropsScript(props),
    );
  };
}

function wrapInteractiveComponent(name: string, component: any, livePricing: boolean) {
  if (!INTERACTIVE_COMPONENTS.has(name)) return component;

  return {
    ...component,
    render: islandRenderer(name, component.render, livePricing),
  };
}

function islandConfigFrom(baseConfig: Config, livePricing: boolean): Config {
  const components = Object.fromEntries(
    Object.entries(baseConfig.components as PuckComponentConfig).map(([name, component]) => [
      name,
      wrapInteractiveComponent(name, component, livePricing),
    ]),
  );

  return { ...baseConfig, components } as Config;
}

export function renderPuckToHtml(data: Data, ssrOrderData?: any): string {
  return staticMarkup(puckConfig as Config, withOrderDetailsData(data, ssrOrderData, true));
}

// livePricing: false is for routes that never mount the IslandHydrator, where a loading state
// would never resolve.
export function renderPuckToHtmlWithIslands(data: Data, ssrOrderData?: any, options: { livePricing?: boolean } = {}): string {
  const config = islandConfigFrom(puckConfig as Config, options.livePricing ?? true);
  return staticMarkup(config, withOrderDetailsData(data, ssrOrderData));
}
