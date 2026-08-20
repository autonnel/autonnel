import { toolRoute } from '@/composition/mcp/rest-bridge';

// Multipart binary upload stays at ./upload; this is the URL-download mode.
export const POST = toolRoute('upload_media', { status: 201 });
