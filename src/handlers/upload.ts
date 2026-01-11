import type { Env, UploadRequest, ApiResponse } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { notifyFileUpload } from '../lib/email';
import { safeDecodeBase64 } from '../lib/base64';
import { isValidFilename, isValidFileType } from '../lib/validation';
import { storeUpload } from '../lib/storage';
import { verifyTurnstile } from '../lib/turnstile';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: UploadRequest = await request.json();

    // Verify Turnstile token
    const clientIP = request.headers.get('CF-Connecting-IP') || undefined;
    const turnstileValid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIP
    );
    if (!turnstileValid) {
      return errorResponse('CAPTCHA verification failed. Please try again.', 403);
    }

    // Validate required fields
    if (!body.file || !body.filename) {
      return errorResponse('Missing file or filename');
    }

    // Validate filename
    if (!isValidFilename(body.filename)) {
      return errorResponse('Invalid filename');
    }

    // Validate file type
    const mimeType = body.fileType || 'application/octet-stream';
    if (!isValidFileType(mimeType)) {
      return errorResponse('File type not allowed');
    }

    // Decode base64 file
    const fileBytes = safeDecodeBase64(body.file);
    if (!fileBytes) {
      return errorResponse('Invalid file encoding');
    }

    // Check file size
    const maxSize = parseInt(env.MAX_FILE_SIZE, 10);
    if (fileBytes.length > maxSize) {
      return errorResponse('File exceeds maximum size of 100MB', 413);
    }

    // Store file using unified storage
    const { uploadId } = await storeUpload(env, fileBytes, {
      filename: body.filename,
      mimeType,
      size: fileBytes.length,
      description: body.description,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      source: 'web',
    });

    // Send notification email (don't await - fire and forget)
    notifyFileUpload(
      uploadId,
      body.filename,
      fileBytes.length,
      body.description,
      body.contactName,
      body.contactEmail
    ).catch(err => console.error('Notification failed:', err));

    const response: ApiResponse = {
      success: true,
      uploadId: uploadId,
      message: 'File uploaded successfully. Your submission ID is: ' + uploadId.slice(0, 8)
    };
    return jsonResponse(response);

  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('Upload failed. Please try again.', 500);
  }
}
