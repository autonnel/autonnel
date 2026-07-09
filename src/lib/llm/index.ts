import { openaiChatProvider } from './providers/text/openai-chat';
import { anthropicMessagesProvider } from './providers/text/anthropic-messages';
import { openaiImagesProvider } from './providers/image/openai-images';
import { geminiImageProvider } from './providers/image/gemini-image';
import { bflFluxProvider } from './providers/image/bfl-flux';
import { stabilityProvider } from './providers/image/stability';
import { replicateProvider } from './providers/image/replicate';
import { falProvider } from './providers/image/fal';
import { huggingfaceInferenceProvider } from './providers/image/huggingface-inference';
import { openaiVideoProvider } from './providers/video/openai-video';
import { runwayVideoProvider } from './providers/video/runway-video';
import { lumaVideoProvider } from './providers/video/luma-video';
import { googleVeoProvider } from './providers/video/google-veo';
import { replicateVideoProvider } from './providers/video/replicate-video';
import { falVideoProvider } from './providers/video/fal-video';
import {
  registerTextProvider, registerImageProvider, registerVideoProvider,
} from './registry';

registerTextProvider(openaiChatProvider);
registerTextProvider(anthropicMessagesProvider);
registerImageProvider(openaiImagesProvider);
registerImageProvider(geminiImageProvider);
registerImageProvider(bflFluxProvider);
registerImageProvider(stabilityProvider);
registerImageProvider(replicateProvider);
registerImageProvider(falProvider);
registerImageProvider(huggingfaceInferenceProvider);
registerVideoProvider(openaiVideoProvider);
registerVideoProvider(runwayVideoProvider);
registerVideoProvider(lumaVideoProvider);
registerVideoProvider(googleVeoProvider);
registerVideoProvider(replicateVideoProvider);
registerVideoProvider(falVideoProvider);

export * from './types';
export * from './errors';
export { fetchWithRetry } from './http';
export { pollJob } from './poll';
export { pollPrediction } from './poll-prediction';
export { callText, isLlmConfigured } from './call-text';
export { callImage } from './call-image';
export { callVideo } from './call-video';
export {
  getTextProvider, listTextProviders,
  getImageProvider, listImageProviders,
  getVideoProvider, listVideoProviders,
} from './registry';
