/**
 * Unified storage utilities for uploads
 *
 * Handles storing files in R2 and metadata in D1
 */

import type { Env } from '../types';
import { timestamp } from './config';
import { log, error } from './logger';

export interface UploadMetadata {
  filename: string;
  mimeType: string;
  size: number;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  source?: 'web' | 'email';
  emailFrom?: string;
  emailSubject?: string;
}

export interface StoredUpload {
  uploadId: string;
  r2Key: string;
}

/**
 * Store a file upload in R2 and metadata in D1
 */
export async function storeUpload(
  env: Env,
  fileData: Uint8Array,
  metadata: UploadMetadata
): Promise<StoredUpload> {
  const uploadId = crypto.randomUUID();
  const r2Key = `uploads/${uploadId}`;
  const now = timestamp();

  log('storage', 'Storing upload', {
    uploadId,
    r2Key,
    filename: metadata.filename,
    mimeType: metadata.mimeType,
    size: fileData.length,
    source: metadata.source
  });

  // Build full metadata object
  const fullMetadata = {
    ...metadata,
    timestamp: now,
  };

  // Store file in R2
  log('storage', 'Uploading to R2...');
  try {
    await env.UPLOADS_BUCKET.put(r2Key, fileData, {
      customMetadata: {
        filename: metadata.filename,
        source: metadata.source || 'web',
        uploadedAt: now,
      },
    });
    log('storage', 'R2 upload successful');
  } catch (err) {
    error('storage', 'R2 upload failed', err);
    throw err;
  }

  // Store metadata in D1
  log('storage', 'Storing metadata in D1...');
  try {
    await env.DB.prepare(`
      INSERT INTO upload_metadata
        (id, r2_key, file_type, file_size, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      uploadId,
      r2Key,
      metadata.mimeType,
      fileData.length,
      JSON.stringify(fullMetadata)
    ).run();
    log('storage', 'D1 metadata stored successfully');
  } catch (err) {
    error('storage', 'D1 metadata storage failed', err);
    throw err;
  }

  return { uploadId, r2Key };
}

/**
 * Store a contact submission in D1
 */
export async function storeContactSubmission(
  env: Env,
  submissionType: string,
  message: string,
  name?: string | null,
  email?: string | null
): Promise<void> {
  log('storage', 'Storing contact submission', {
    submissionType,
    messageLength: message.length,
    hasName: !!name,
    hasEmail: !!email
  });

  try {
    const result = await env.DB.prepare(`
      INSERT INTO contact_submissions
        (submission_type, name, email, message)
      VALUES (?, ?, ?, ?)
    `).bind(
      submissionType,
      name || null,
      email || null,
      message
    ).run();
    log('storage', 'Contact submission stored successfully', { meta: result.meta });
  } catch (err) {
    error('storage', 'Contact submission storage failed', err);
    throw err;
  }
}
