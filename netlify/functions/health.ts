// Netlify Function v2: GET /api/health
export const config = { path: '/api/health' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return Response.json({ error: 'متد مجاز نیست.' }, { status: 405 });
  }
  return Response.json({ status: 'ok', time: new Date().toISOString() });
}
