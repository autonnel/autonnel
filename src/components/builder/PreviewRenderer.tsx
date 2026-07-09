import type { CSSProperties } from 'react';
import { Render } from '@puckeditor/core';
import type { Data } from '@puckeditor/core';
import { puckConfig } from './config';
import { applyPuckDefaults } from '@/lib/puck/apply-default-props';

interface SimplePreviewProps {
  data: Data;
}

const fullPage: CSSProperties = { minHeight: '100vh' };

const emptyStage: CSSProperties = {
  ...fullPage,
  alignItems: 'center',
  background: '#f8fafc',
  display: 'flex',
  justifyContent: 'center',
};

function EmptyState() {
  return (
    <div style={emptyStage}>
      <p style={{ color: '#64748b' }}>No content available</p>
    </div>
  );
}

export function PreviewRenderer({ data }: SimplePreviewProps) {
  if (!data) return <EmptyState />;

  return (
    <div style={{ ...fullPage, background: '#ffffff' }}>
      <Render config={puckConfig} data={applyPuckDefaults(data, puckConfig)} />
    </div>
  );
}
