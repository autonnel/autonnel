import { registerStorefrontHandlers } from './storefront-runtime';
import { registerMediaGenerationHandlers } from './make-media-generation';
import { registerRecallHandlers } from './make-recall-deps';
// messaging.send and ads.postback.dispatch register as top-level import side effects.
import './make-messaging';
import './make-acquisition-ads';

// Every drain entry point (cron worker, /api/cron/drain, inline checkout drain) must register the
// full handler set before polling: the queue reclaims jobs of any kind, and a missing handler would
// mark an otherwise-deliverable job FAILED. registerJobHandler is idempotent.
export function registerAllJobHandlers(): void {
  registerStorefrontHandlers();
  registerMediaGenerationHandlers();
  registerRecallHandlers();
}
