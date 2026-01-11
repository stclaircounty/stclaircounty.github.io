import type { Env } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { log, error } from '../lib/logger';

interface ContactRow {
  id: number;
  submission_type: string;
  name: string | null;
  email: string | null;
  message: string;
  created_at: string;
  processed: number;
}

interface UploadRow {
  id: string;
  r2_key: string;
  file_type: string;
  file_size: number;
  metadata: string;
  created_at: string;
  downloaded: number;
}

function verifyAuth(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  const [type, token] = authHeader.split(' ');
  if (type !== 'Bearer') return false;

  return token === env.ADMIN_SECRET;
}

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  log('admin', 'Request received', { path, method: request.method });

  // Verify auth for all admin routes
  if (!verifyAuth(request, env)) {
    log('admin', 'Unauthorized request');
    return errorResponse('Unauthorized', 401);
  }

  try {
    // GET /api/admin/contacts - List contact submissions
    if (path === '/api/admin/contacts' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const result = await env.DB.prepare(`
        SELECT id, submission_type, name, email, message, created_at, processed
        FROM contact_submissions
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all<ContactRow>();

      const countResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM contact_submissions'
      ).first<{ count: number }>();

      log('admin', 'Fetched contacts', { count: result.results.length, total: countResult?.count });

      return jsonResponse({
        success: true,
        data: result.results,
        total: countResult?.count || 0,
        limit,
        offset
      });
    }

    // GET /api/admin/uploads - List uploads
    if (path === '/api/admin/uploads' && request.method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      const result = await env.DB.prepare(`
        SELECT id, r2_key, file_type, file_size, metadata, created_at, downloaded
        FROM upload_metadata
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(limit, offset).all<UploadRow>();

      const countResult = await env.DB.prepare(
        'SELECT COUNT(*) as count FROM upload_metadata'
      ).first<{ count: number }>();

      // Parse metadata JSON for each upload
      const uploads = result.results.map(row => ({
        ...row,
        metadata: JSON.parse(row.metadata || '{}')
      }));

      log('admin', 'Fetched uploads', { count: uploads.length, total: countResult?.count });

      return jsonResponse({
        success: true,
        data: uploads,
        total: countResult?.count || 0,
        limit,
        offset
      });
    }

    // GET /api/admin/download/:id - Download a file
    if (path.startsWith('/api/admin/download/') && request.method === 'GET') {
      const uploadId = path.replace('/api/admin/download/', '');

      const meta = await env.DB.prepare(
        'SELECT r2_key, file_type, metadata FROM upload_metadata WHERE id = ?'
      ).bind(uploadId).first<{ r2_key: string; file_type: string; metadata: string }>();

      if (!meta) {
        return errorResponse('Upload not found', 404);
      }

      const file = await env.UPLOADS_BUCKET.get(meta.r2_key);
      if (!file) {
        return errorResponse('File not found in storage', 404);
      }

      const metadata = JSON.parse(meta.metadata || '{}');
      const filename = metadata.filename || 'download';

      // Mark as downloaded
      await env.DB.prepare(
        'UPDATE upload_metadata SET downloaded = 1, downloaded_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(uploadId).run();

      log('admin', 'File downloaded', { uploadId, filename });

      return new Response(file.body, {
        headers: {
          'Content-Type': meta.file_type,
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      });
    }

    // POST /api/admin/contacts/:id/process - Mark contact as processed
    if (path.match(/^\/api\/admin\/contacts\/\d+\/process$/) && request.method === 'POST') {
      const id = path.split('/')[4];

      await env.DB.prepare(
        'UPDATE contact_submissions SET processed = 1, processed_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(id).run();

      log('admin', 'Contact marked processed', { id });

      return jsonResponse({ success: true, message: 'Marked as processed' });
    }

    return errorResponse('Not found', 404);

  } catch (err) {
    error('admin', 'Error', err);
    return errorResponse('Internal error', 500);
  }
}
