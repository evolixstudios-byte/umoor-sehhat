import { handle } from '../../shared/handler.mjs';
export default async (request) => {
  const result = await handle({
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.text(),
    secure: new URL(request.url).protocol === 'https:' || request.headers.get('x-forwarded-proto') === 'https',
  });
  return new Response(result.body, { status: result.status, headers: result.headers });
};
export const config = { path: '/api' };
