import type { SubmissionType } from './lib/config';

export interface Env {
  DB: D1Database;
  UPLOADS_BUCKET: R2Bucket;
  ASSETS: Fetcher;
  SITE_NAME: string;
  MAX_FILE_SIZE: string;
  TURNSTILE_SECRET_KEY: string;
}

export interface ContactSubmission {
  submission_type: SubmissionType;
  name?: string;
  email?: string;
  message: string;
  turnstileToken: string;
}

export interface UploadRequest {
  file: string; // base64 encoded file
  filename: string;
  fileType: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  turnstileToken: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  uploadId?: string;
}

// Re-export for convenience
export type { SubmissionType } from './lib/config';
