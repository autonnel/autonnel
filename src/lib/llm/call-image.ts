import { getLlmModel } from '@/lib/config/llm-models';
import { LlmNotConfiguredError } from './errors';
import { normalizeToS3Url } from './image-output';
import { getImageProvider } from './registry';

export interface CallImageOptions {
  modelName?: string;
  prompt: string;
  aspectRatio?: string;
  inputImageUrl?: string;
  inputImageBase64?: string;
  inputImageMimeType?: string;
  userId?: string;
}

export async function callImage(options: CallImageOptions): Promise<string> {
  const name = options.modelName?.trim();
  const row =
    (name ? await getLlmModel('image', name) : undefined) ??
    (await getLlmModel('image'));
  if (!row) throw new LlmNotConfiguredError();

  const provider = getImageProvider(row.provider);
  const outputs = await provider.generateImage(
    {
      prompt: options.prompt,
      aspectRatio: options.aspectRatio,
      inputImageUrl: options.inputImageUrl,
      inputImageBase64: options.inputImageBase64,
      inputImageMimeType: options.inputImageMimeType,
    },
    row,
  );
  if (!outputs.length) throw new Error('No image generated');
  return normalizeToS3Url(outputs[0], options.userId);
}
