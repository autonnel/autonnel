import { toolRoute } from '@/composition/mcp/rest-bridge';

// /templates is already taken by the email-template list; page templates live here.
export const GET = toolRoute('list_templates');
