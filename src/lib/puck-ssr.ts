import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Render } from '@puckeditor/core/rsc';
import type { Config, Data } from '@puckeditor/core';
import { INTERACTIVE_COMPONENTS } from '@/components/builder/interactive-components';
import { puckConfig } from '@/components/builder/config';
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

function islandRenderer(componentName: string, renderComponent: (props: any) => any) {
  return function RenderIsland(props: any) {
    return createElement(
      'div',
      { 'data-island': componentName, 'data-island-id': props.id || '' },
      createElement(renderComponent, props),
      serializedPropsScript(props),
    );
  };
}

function wrapInteractiveComponent(name: string, component: any) {
  if (!INTERACTIVE_COMPONENTS.has(name)) return component;

  return {
    ...component,
    render: islandRenderer(name, component.render),
  };
}

function islandConfigFrom(baseConfig: Config): Config {
  const components = Object.fromEntries(
    Object.entries(baseConfig.components as PuckComponentConfig).map(([name, component]) => [
      name,
      wrapInteractiveComponent(name, component),
    ]),
  );

  return { ...baseConfig, components } as Config;
}

export function renderPuckToHtml(data: Data, ssrOrderData?: any): string {
  return staticMarkup(puckConfig as Config, withOrderDetailsData(data, ssrOrderData, true));
}

export function renderPuckToHtmlWithIslands(data: Data, ssrOrderData?: any): string {
  return staticMarkup(islandConfigFrom(puckConfig as Config), withOrderDetailsData(data, ssrOrderData));
}
