// 401 for no principal at all, 403 for a principal that lacks the feature -- matches
// withAuthAnyOf's split (src/lib/api-helpers.ts) used by the other ads endpoints.
export function forbiddenJson(status: 401 | 403): Response {
  const message = status === 401 ? 'Unauthorized' : 'Forbidden';
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
