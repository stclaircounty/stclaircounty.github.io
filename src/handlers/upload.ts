import type { Env, UploadRequest, ApiResponse } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { notifyFileUpload } from '../lib/email';
import { safeDecodeBase64 } from '../lib/base64';
import { isValidFilename, isValidFileType } from '../lib/validation';
import { storeUpload } from '../lib/storage';
import { verifyTurnstile } from '../lib/turnstile';
import { log, error } from '../lib/logger';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  log('upload', 'Request received', { method: request.method });

  if (request.method !== 'POST') {
    log('upload', 'Method not allowed', { method: request.method });
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: UploadRequest = await request.json();
    log('upload', 'Body parsed', {
      hasFile: !!body.file,
      fileLength: body.file?.length,
      filename: body.filename,
      fileType: body.fileType,
      hasDescription: !!body.description,
      hasContactName: !!body.contactName,
      hasContactEmail: !!body.contactEmail,
      hasTurnstileToken: !!body.turnstileToken
    });

    // Verify Turnstile token
    const clientIP = request.headers.get('CF-Connecting-IP') || undefined;
    log('upload', 'Verifying Turnstile', { clientIP, hasSecretKey: !!env.TURNSTILE_SECRET_KEY });

    const turnstileValid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIP
    );
    log('upload', 'Turnstile result', { valid: turnstileValid });

    if (!turnstileValid) {
      log('upload', 'Turnstile verification failed');
      return errorResponse('CAPTCHA verification failed. Please try again.', 403);
    }

    // Validate required fields
    if (!body.file || !body.filename) {
      log('upload', 'Missing file or filename');
      return errorResponse('Missing file or filename');
    }

    // Validate filename
    log('upload', 'Validating filename', { filename: body.filename });
    if (!isValidFilename(body.filename)) {
      log('upload', 'Invalid filename');
      return errorResponse('Invalid filename');
    }

    // Validate file type
    const mimeType = body.fileType || 'application/octet-stream';
    log('upload', 'Validating file type', { mimeType });
    if (!isValidFileType(mimeType)) {
      log('upload', 'File type not allowed');
      return errorResponse('File type not allowed');
    }

    // Decode base64 file
    log('upload', 'Decoding base64...');
    const fileBytes = safeDecodeBase64(body.file);
    if (!fileBytes) {
      log('upload', 'Invalid file encoding');
      return errorResponse('Invalid file encoding');
    }
    log('upload', 'Decoded file', { size: fileBytes.length });

    // Check file size
    const maxSize = parseInt(env.MAX_FILE_SIZE, 10);
    log('upload', 'Checking file size', { fileSize: fileBytes.length, maxSize });
    if (fileBytes.length > maxSize) {
      log('upload', 'File exceeds max size');
      return errorResponse('File exceeds maximum size of 100MB', 413);
    }

    // Store file using unified storage
    log('upload', 'Storing file...');
    const { uploadId } = await storeUpload(env, fileBytes, {
      filename: body.filename,
      mimeType,
      size: fileBytes.length,
      description: body.description,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      source: 'web',
    });
    log('upload', 'File stored successfully', { uploadId });

    // Send notification email (don't await - fire and forget)
    log('upload', 'Sending notification email...');
    notifyFileUpload(
      uploadId,
      body.filename,
      fileBytes.length,
      body.description,
      body.contactName,
      body.contactEmail
    ).catch(err => error('upload', 'Notification failed', err));

    const response: ApiResponse = {
      success: true,
      uploadId: uploadId,
      message: 'File uploaded successfully. Your submission ID is: ' + uploadId.slice(0, 8)
    };
    log('upload', 'Success, returning response');
    return jsonResponse(response);

  } catch (err) {
    error('upload', 'Error', err);
    return errorResponse('Upload failed. Please try again.', 500);
  }
}
