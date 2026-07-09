import type { Data } from '@puckeditor/core';
import type { BuilderExtension, PluginTemplate } from '@/lib/plugins/types';
import { SampleStatic } from './SampleStatic';
import { SampleInteractive } from './SampleInteractive';

const sampleStaticData: Data = {
  root: { props: {} },
  content: [
    { type: 'sample:Static', props: { id: 'sample-static-1', heading: 'From Template', tone: 'bold' } },
  ],
  zones: {},
};

export const sampleTemplates: PluginTemplate[] = [
  {
    value: 'sample:lp-static',
    label: 'Sample Landing (static)',
    subtitle: 'Driven by static data',
    section: 'funnel',
    defaultPageType: 'CUSTOM',
    defaultSlug: 'sample-lp',
    thumbnail: '/sample-thumb.png',
    data: sampleStaticData,
    requires: ['sample:Static'],
  },
  {
    value: 'sample:lp-generated',
    label: 'Sample Landing (generated)',
    section: 'funnel',
    defaultPageType: 'CUSTOM',
    generator: () => ({
      root: { props: {} },
      content: [
        { type: 'sample:Interactive', props: { id: 'sample-interactive-1', buttonLabel: 'Generated' } },
      ],
      zones: {},
    }),
    requires: ['sample:Interactive'],
  },
];

export const builderExtension: BuilderExtension = {
  name: 'sample',
  templates: sampleTemplates,
  puckComponents: {
    'sample:Static': {
      config: {
        label: 'Sample Static',
        fields: { heading: { type: 'text' } },
        defaultProps: { heading: 'Sample Heading', tone: 'neutral' },
        render: SampleStatic as never,
      },
      category: 'Sample',
      schema: { allowedZones: ['root'], requiredProps: ['heading'] },
    },
    'sample:Interactive': {
      config: {
        label: 'Sample Interactive',
        fields: { buttonLabel: { type: 'text' } },
        defaultProps: { buttonLabel: 'Tap me' },
        render: SampleInteractive as never,
      },
      load: () => import('./SampleInteractive').then((m) => m.SampleInteractive),
    },
  },
};

export const samplePluginExtension = builderExtension;
