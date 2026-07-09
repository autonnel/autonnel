import type { IBlockData, IPage } from 'easy-email-core';
import { BasicType } from 'easy-email-core';

type BaseNode = IBlockData;

export function page(opts: { backgroundColor?: string; rows: BaseNode[] }): IPage {
  return {
    type: BasicType.PAGE,
    data: { value: { breakpoint: '480px' } },
    attributes: {
      'background-color': opts.backgroundColor ?? '#ffffff',
      width: '600px',
    },
    children: opts.rows,
  } as unknown as IPage;
}

export function section(opts: { backgroundColor?: string; padding?: string; children: BaseNode[] }): BaseNode {
  return {
    type: BasicType.SECTION,
    data: { value: {} },
    attributes: {
      padding: opts.padding ?? '20px 0',
      'background-color': opts.backgroundColor ?? 'transparent',
    },
    children: [
      {
        type: BasicType.COLUMN,
        data: { value: {} },
        attributes: { padding: '0', 'vertical-align': 'top' },
        children: opts.children,
      },
    ],
  };
}

export function text(opts: { html: string; align?: 'left' | 'center' | 'right'; padding?: string }): BaseNode {
  return {
    type: BasicType.TEXT,
    data: { value: { content: opts.html } },
    attributes: {
      padding: opts.padding ?? '10px 25px',
      align: opts.align ?? 'left',
      'line-height': '1.6',
      'font-size': '14px',
      color: '#1f2937',
    },
    children: [],
  };
}

export function button(opts: { text: string; href: string; backgroundColor?: string }): BaseNode {
  return {
    type: BasicType.BUTTON,
    data: { value: { content: opts.text } },
    attributes: {
      href: opts.href,
      'background-color': opts.backgroundColor ?? '#2563eb',
      color: '#ffffff',
      'border-radius': '6px',
      padding: '12px 25px',
      'font-size': '14px',
      'font-weight': '600',
      align: 'center',
    },
    children: [],
  };
}

export function infoBox(opts: { html: string; backgroundColor?: string }): BaseNode {
  return {
    type: BasicType.TEXT,
    data: { value: { content: opts.html } },
    attributes: {
      padding: '15px 25px',
      'background-color': opts.backgroundColor ?? '#f9fafb',
      'line-height': '1.6',
      'font-size': '13px',
      color: '#374151',
    },
    children: [],
  };
}

export function callout(opts: { html: string; backgroundColor: string }): BaseNode {
  return {
    type: BasicType.TEXT,
    data: { value: { content: opts.html } },
    attributes: {
      padding: '15px 25px',
      'background-color': opts.backgroundColor,
      'line-height': '1.6',
      'font-size': '14px',
      'font-weight': '500',
      color: '#92400e',
    },
    children: [],
  };
}

export function headerSection(opts: { text: string; backgroundColor?: string; color?: string }): BaseNode {
  return section({
    backgroundColor: opts.backgroundColor ?? '#1f2937',
    padding: '24px',
    children: [
      {
        type: BasicType.TEXT,
        data: { value: { content: opts.text } },
        attributes: {
          padding: '0',
          align: 'center',
          'font-size': '20px',
          'font-weight': '700',
          color: opts.color ?? '#ffffff',
        },
        children: [],
      },
    ],
  });
}

export function footerSection(opts: { text: string }): BaseNode {
  return section({
    backgroundColor: '#f9fafb',
    padding: '20px 24px',
    children: [
      {
        type: BasicType.TEXT,
        data: { value: { content: opts.text } },
        attributes: {
          padding: '0',
          align: 'center',
          'font-size': '12px',
          color: '#6b7280',
          'line-height': '1.5',
        },
        children: [],
      },
    ],
  });
}
