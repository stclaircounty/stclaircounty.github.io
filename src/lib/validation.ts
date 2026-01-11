/**
 * Input validation utilities
 */

import { SUBMISSION_TYPES, MAX_MESSAGE_LENGTH, MIN_MESSAGE_LENGTH, ALLOWED_FILE_TYPES } from './config';

/**
 * Validate email format using RFC 5322 simplified pattern
 */
export function isValidEmail(email: string): boolean {
  // More comprehensive email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate submission type
 */
export function isValidSubmissionType(type: string): boolean {
  return SUBMISSION_TYPES.includes(type as typeof SUBMISSION_TYPES[number]);
}

/**
 * Validate message length
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  const trimmed = message?.trim() || '';

  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be at least ${MIN_MESSAGE_LENGTH} characters` };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be less than ${MAX_MESSAGE_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Validate file type by MIME type
 */
export function isValidFileType(mimeType: string): boolean {
  // Allow if in whitelist or if it's a common document/media type
  if (ALLOWED_FILE_TYPES.includes(mimeType)) {
    return true;
  }

  // Allow common type prefixes
  const allowedPrefixes = ['image/', 'video/', 'audio/', 'text/'];
  return allowedPrefixes.some(prefix => mimeType.startsWith(prefix));
}

/**
 * Validate filename for dangerous patterns
 */
export function isValidFilename(filename: string): boolean {
  // Reject empty or too long
  if (!filename || filename.length > 255) {
    return false;
  }

  // Reject path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Reject null bytes
  if (filename.includes('\0')) {
    return false;
  }

  return true;
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[/\\:*?"<>|]/g, '_')  // Replace dangerous chars
    .replace(/\.{2,}/g, '.')         // Collapse multiple dots
    .slice(0, 255);                  // Limit length
}
