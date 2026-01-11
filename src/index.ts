/**
 * St. Clair County Accountability Site - Worker Entry Point
 *
 * HTTP Routes:
 * - /api/contact (POST) - Contact form submissions
 * - /api/upload/complete (POST) - Encrypted file uploads
 * - /api/health (GET) - Health check
 * - /* - Static assets (Hugo site)
 *
 * Email Routes:
 * - tip@stclaircounty.net → Contact submission (type: tip)
 * - contact@stclaircounty.net → Contact submission (type: general)
 * - Attachments → Encrypted and stored in R2
 */

import type { Env } from './types';
import { addSecurityHeaders, checkRateLimit } from './middleware';
import { handleContact } from './handlers/contact';
import { handleUpload } from './handlers/upload';
import { handleHealth } from './handlers/health';
import { handleEmail } from './handlers/email';
import { handleAdmin } from './handlers/admin';
import { initLogger } from './lib/logger';

export default {
  // HTTP request handler
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    initLogger(env.ENABLE_LOGGING);
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith('/api/')) {
      // Rate limiting for API routes
      const rateLimitResponse = await checkRateLimit(request, env);
      if (rateLimitResponse) {
        return addSecurityHeaders(rateLimitResponse);
      }

      let response: Response;

      // Route to appropriate handler
      if (path === '/api/contact') {
        response = await handleContact(request, env);
      } else if (path === '/api/upload/complete') {
        response = await handleUpload(request, env);
      } else if (path === '/api/health') {
        response = await handleHealth(request, env);
      } else if (path.startsWith('/api/admin/')) {
        response = await handleAdmin(request, env);
      } else {
        response = new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return addSecurityHeaders(response);
    }

    // Static assets - let Cloudflare handle from [assets] binding
    return env.ASSETS.fetch(request);
  },

  // Email handler for tip@/contact@ addresses
  async email(message: ForwardableEmailMessage, env: Env, _ctx: ExecutionContext): Promise<void> {
    initLogger(env.ENABLE_LOGGING);
    await handleEmail(message, env);
  }
};
