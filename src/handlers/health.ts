import type { Env } from '../types';
import { jsonResponse } from '../middleware';

export async function handleHealth(_request: Request, env: Env): Promise<Response> {
  const checks: Record<string, boolean> = {
    api: true,
    d1: false,
    r2: false
  };

  // Check D1
  try {
    await env.DB.prepare('SELECT 1').run();
    checks.d1 = true;
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

  return jsonResponse({
    status: allHealthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  }, allHealthy ? 200 : 503);
}
