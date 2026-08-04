// Response helpers for the external v1.1 API. Authentication and authorization live in
// `@/composition/external-auth` (withApiPrincipal + requireFeature + requireWriteAccess):
// there is deliberately no helper here that authenticates WITHOUT resolving feature grants,
// because the previous one let routes silently skip authorization.
const CONTENT_TYPE_JSON = { 'Content-Type': 'application/json' } as const;

function send(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: CONTENT_TYPE_JSON });
}

export function jsonError(message: string, status: number): Response {
  return send({ error: { message, type: 'api_error' } }, status);
}

export function jsonResponse(data: unknown, status = 200): Response {
  return send(data, status);
}
