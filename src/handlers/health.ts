import type { Env } from '../types';
import { jsonResponse } from '../middleware';

export async function handleHealth(_request: Request, env: Env): Promise<Response> {
  const checks: Record<string, boolean> = {
    api: true,
    d1: false,
    r2: false
  };

  const stats: Record<string, number> = {
    contacts: 0,
    uploads: 0
  };

  // Check D1 and get stats
  try {
    await env.DB.prepare('SELECT 1').run();
    checks.d1 = true;

    // Get submission counts
    const contactsResult = await env.DB.prepare('SELECT COUNT(*) as count FROM contact_submissions').first<{ count: number }>();
    const uploadsResult = await env.DB.prepare('SELECT COUNT(*) as count FROM upload_metadata').first<{ count: number }>();

    stats.contacts = contactsResult?.count || 0;
    stats.uploads = uploadsResult?.count || 0;
  } catch {
    checks.d1 = false;
  }

  // Check R2 bucket
  try {
    await env.UPLOADS_BUCKET.head('health-check');
    checks.r2 = true;
  } catch (error) {
    // Object not found is OK - bucket is accessible
    if (error instanceof Error && error.message.includes('not found')) {
      checks.r2 = true;
    }
  }

  const allHealthy = Object.values(checks).every(v => v);

  const response = jsonResponse({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    stats,
    timestamp: new Date().toISOString()
  }, allHealthy ? 200 : 503);

  // Cache for 5 minutes at edge, 1 minute in browser
  response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=300');

  return response;
}
