import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Render } from '@puckeditor/core/rsc';
import type { Config, Data } from '@puckeditor/core';
import { mergePuckComponents } from '@/components/builder/merge-extensions';
import { applyPuckDefaults } from '@/lib/puck/apply-default-props';
import { samplePluginExtension } from '../../fixtures/plugin-sample/builder';

const baseConfig = {
  components: {},
  root: { render: ({ children }: { children?: unknown }) => children },
} as unknown as Config;

const mergedConfig = {
  ...baseConfig,
  components: mergePuckComponents(baseConfig.components, [samplePluginExtension]),
} as unknown as Config;

function renderData(data: Data): string {
  return renderToStaticMarkup(
    createElement(Render, {
      config: mergedConfig as never,
      data: applyPuckDefaults(data, mergedConfig),
    }),
  );
}

describe('plugin static component render parity (editor == SSR via applyPuckDefaults)', () => {
  it('renders the plugin component markup with an explicitly-set prop', () => {
    const html = renderData({
      content: [{ type: 'sample:Static', props: { id: 's1', heading: 'Hello Plugin', tone: 'warm' } }],
      root: { props: {} },
    } as unknown as Data);
    expect(html).toContain('data-testid="sample-static"');
    expect(html).toContain('Hello Plugin');
    expect(html).toContain('data-tone="warm"');
  });

  it('back-fills defaultProps when a prop is omitted (parity guarantee)', () => {
    const html = renderData({
      content: [{ type: 'sample:Static', props: { id: 's2', heading: 'Defaults' } }],
      root: { props: {} },
    } as unknown as Data);
    // `tone` was omitted -> default 'neutral' from the plugin config must show in output
    expect(html).toContain('data-tone="neutral"');
    expect(html).toContain('Defaults');
  });
});
