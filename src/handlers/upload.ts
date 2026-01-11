import type { Env, UploadRequest, ApiResponse } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { notifyFileUpload } from '../lib/email';
import { safeDecodeBase64 } from '../lib/base64';
import { isValidFilename, isValidFileType } from '../lib/validation';
import { storeUpload } from '../lib/storage';
import { verifyTurnstile } from '../lib/turnstile';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  console.log('[upload] Request received', { method: request.method });

  if (request.method !== 'POST') {
    console.log('[upload] Method not allowed:', request.method);
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: UploadRequest = await request.json();
    console.log('[upload] Body parsed', {
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
    console.log('[upload] Verifying Turnstile', { clientIP, hasSecretKey: !!env.TURNSTILE_SECRET_KEY });

    const turnstileValid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIP
    );
    console.log('[upload] Turnstile result:', turnstileValid);

    if (!turnstileValid) {
      console.log('[upload] Turnstile verification failed');
      return errorResponse('CAPTCHA verification failed. Please try again.', 403);
    }

    // Validate required fields
    if (!body.file || !body.filename) {
      console.log('[upload] Missing file or filename');
      return errorResponse('Missing file or filename');
    }

    // Validate filename
    console.log('[upload] Validating filename:', body.filename);
    if (!isValidFilename(body.filename)) {
      console.log('[upload] Invalid filename');
      return errorResponse('Invalid filename');
    }

    // Validate file type
    const mimeType = body.fileType || 'application/octet-stream';
    console.log('[upload] Validating file type:', mimeType);
    if (!isValidFileType(mimeType)) {
      console.log('[upload] File type not allowed');
      return errorResponse('File type not allowed');
    }

    // Decode base64 file
    console.log('[upload] Decoding base64...');
    const fileBytes = safeDecodeBase64(body.file);
    if (!fileBytes) {
      console.log('[upload] Invalid file encoding');
      return errorResponse('Invalid file encoding');
    }
    console.log('[upload] Decoded file size:', fileBytes.length);

    // Check file size
    const maxSize = parseInt(env.MAX_FILE_SIZE, 10);
    console.log('[upload] Checking file size', { fileSize: fileBytes.length, maxSize });
    if (fileBytes.length > maxSize) {
      console.log('[upload] File exceeds max size');
      return errorResponse('File exceeds maximum size of 100MB', 413);
    }

    // Store file using unified storage
    console.log('[upload] Storing file...');
    const { uploadId } = await storeUpload(env, fileBytes, {
      filename: body.filename,
      mimeType,
      size: fileBytes.length,
      description: body.description,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      source: 'web',
    });
    console.log('[upload] File stored successfully', { uploadId });

    // Send notification email (don't await - fire and forget)
    console.log('[upload] Sending notification email...');
    notifyFileUpload(
      uploadId,
      body.filename,
      fileBytes.length,
      body.description,
      body.contactName,
      body.contactEmail
    ).catch(err => console.error('[upload] Notification failed:', err));

    const response: ApiResponse = {
      success: true,
      uploadId: uploadId,
      message: 'File uploaded successfully. Your submission ID is: ' + uploadId.slice(0, 8)
    };
    console.log('[upload] Success, returning response');
    return jsonResponse(response);

  } catch (error) {
    console.error('[upload] Error:', error);
    console.error('[upload] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return errorResponse('Upload failed. Please try again.', 500);
  }
}
