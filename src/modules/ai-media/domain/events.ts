export const AI_MEDIA_EVENTS = {
  MediaAssetStored: 'ai_media.asset_stored',
} as const;

export type AiMediaEventName = (typeof AI_MEDIA_EVENTS)[keyof typeof AI_MEDIA_EVENTS];
