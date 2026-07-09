import type { makeRecall } from '../../../../composition/make-recall';

type Recall = ReturnType<typeof makeRecall>;

const DEFAULT_BATCH = 50;

export async function runRecallDueTouchSweep(recall: Recall, batchSize = DEFAULT_BATCH): Promise<{ processed: number }> {
  return recall.processDueTouch.processDueBatch(batchSize);
}

export interface CronDescriptor {
  kind: string;
  run(recall: Recall): Promise<{ processed: number }>;
}

export function registerRecallCron(): CronDescriptor {
  return {
    kind: 'recall.due_touch',
    run: (recall) => runRecallDueTouchSweep(recall),
  };
}
