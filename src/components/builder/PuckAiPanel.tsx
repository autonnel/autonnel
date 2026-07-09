import React from 'react';
import { AiPanelBase } from '@/components/ai-panel/AiPanelBase';
import { usePuckAdapter } from './ai-panel/puck-adapter';

interface PuckAiPanelProps {
  pageId: string;
}

export function PuckAiPanel({ pageId }: PuckAiPanelProps) {
  const adapter = usePuckAdapter();
  return <AiPanelBase pageId={pageId} adapter={adapter} />;
}
