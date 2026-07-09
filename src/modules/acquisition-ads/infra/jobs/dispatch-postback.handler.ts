import type { DispatchPostbackService } from '../../application/dispatch-postback.service';

export function makeDispatchPostbackHandler(deps: { dispatchService: DispatchPostbackService }) {
  return {
    kind: 'ads.postback.dispatch' as const,
    async run(job: { payload: { postbackId: string } }): Promise<{ status: string }> {
      return deps.dispatchService.dispatch({ postbackId: job.payload.postbackId });
    },
  };
}
