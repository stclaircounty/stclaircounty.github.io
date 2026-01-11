import type { Env } from './types';
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
  RATE_LIMIT_SALT
} from './lib/config';

export async function hashString(input: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export async function checkRateLimit(request: Request, env: Env): Promise<Response | null> {
  const clientIP = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
  const ipHash = await hashString(clientIP, RATE_LIMIT_SALT);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - RATE_LIMIT_WINDOW_SECONDS;

  try {
    // Clean old entries and count recent requests in one query
    const result = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM rate_limits
      WHERE ip_hash = ? AND timestamp > ?
    `).bind(ipHash, windowStart).first<{ count: number }>();

    const count = result?.count || 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS)
        }
      });
    }

    // Record this request
    await env.DB.prepare(`
      INSERT INTO rate_limits (ip_hash, timestamp) VALUES (?, ?)
    `).bind(ipHash, now).run();

    // Periodically clean old entries (1% chance per request)
    if (Math.random() < 0.01) {
      await env.DB.prepare(`
        DELETE FROM rate_limits WHERE timestamp < ?
      `).bind(windowStart).run();
    }

  } catch (error) {
    // If rate limiting fails, allow the request (fail open)
    console.error('Rate limit check failed:', error);
  }

  return null;
}

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(error: string, status = 400): Response {
  return jsonResponse({ success: false, error }, status);
}
