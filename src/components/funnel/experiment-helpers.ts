import type { ExperimentDto, ExperimentGoalDto } from '@/contracts/funnel';

export const ARM_COLORS = ['#111827', '#2563EB', '#7C3AED', '#059669', '#D97706', '#DB2777', '#0891B2'];

export interface Option {
  id: string;
  name: string;
}

export interface PageOption {
  id: string;
  title: string;
}

export const STATUS_TONE: Record<ExperimentDto['status'], 'muted' | 'ok' | 'default'> = {
  draft: 'muted',
  running: 'ok',
  concluded: 'default',
};

export function goalLabel(goal: ExperimentGoalDto): string {
  return goal.kind === 'order' ? 'Order placed' : `Step reached: ${goal.stepId}`;
}

export function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function liftLabel(lift: number | null): string {
  if (lift === null) return '';
  const sign = lift >= 0 ? '+' : '';
  return `${sign}${(lift * 100).toFixed(1)}%`;
}
