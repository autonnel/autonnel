export type PublishState = 'draft' | 'published' | 'draft_ahead';
export type DraftStatus = 'clean' | 'dirty';

const TRANSITIONS: Record<PublishState, PublishState[]> = {
  draft: ['published'],
  published: ['draft_ahead'],
  draft_ahead: ['published'],
};

export function canPublish(state: PublishState): boolean {
  return state === 'draft' || state === 'draft_ahead';
}

export function canTransitionTo(from: PublishState, to: PublishState): boolean {
  return TRANSITIONS[from].includes(to);
}
