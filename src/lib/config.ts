/**
 * Centralized configuration constants
 *
 * Values that should eventually be environment variables are marked with comments.
 * For now, they're centralized here for easy management.
 */

// Submission types (single source of truth)
export const SUBMISSION_TYPES = ['tip', 'document', 'correction', 'general', 'media'] as const;
export type SubmissionType = typeof SUBMISSION_TYPES[number];

// Rate limiting
export const RATE_LIMIT_MAX_REQUESTS = 10;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
// TODO: Move to environment variable
export const RATE_LIMIT_SALT = 'rate-limit-salt-v1';

// Message validation
export const MIN_MESSAGE_LENGTH = 10;
export const MAX_MESSAGE_LENGTH = 50000; // 50KB of text

// Email configuration
// TODO: Move to environment variables
export const NOTIFICATION_EMAIL = 'notifications@stclaircounty.net';
export const FROM_EMAIL = 'noreply@stclaircounty.net';
export const FROM_NAME = 'St. Clair Under Oath';

// File upload configuration
export const ALLOWED_FILE_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/rtf',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-7z-compressed',
  'application/x-rar-compressed',
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/tiff',
  // Video
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
];

// File size formatting
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Timestamp helper
export function timestamp(): string {
  return new Date().toISOString();
}
