import type { Capability } from '../value-objects/capability';

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'text/plain': 'txt',
};

export class MediaTypeClassifier {
  capabilityOf(contentType: string): Capability {
    const family = contentType.split('/')[0];
    if (family === 'image') return 'IMAGE';
    if (family === 'video') return 'VIDEO';
    return 'TEXT';
  }
  extensionOf(contentType: string): string {
    return EXT[contentType] ?? contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') ?? 'bin';
  }
}
