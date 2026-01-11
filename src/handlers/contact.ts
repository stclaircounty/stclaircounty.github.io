import type { Env, ContactSubmission, ApiResponse } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { notifyContactSubmission } from '../lib/email';
import { isValidEmail, isValidSubmissionType, validateMessage } from '../lib/validation';
import { storeContactSubmission } from '../lib/storage';
import { verifyTurnstile } from '../lib/turnstile';

export async function handleContact(request: Request, env: Env): Promise<Response> {
  console.log('[contact] Request received', { method: request.method });

  if (request.method !== 'POST') {
    console.log('[contact] Method not allowed:', request.method);
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: ContactSubmission = await request.json();
    console.log('[contact] Body parsed', {
      submission_type: body.submission_type,
      hasMessage: !!body.message,
      messageLength: body.message?.length,
      hasName: !!body.name,
      hasEmail: !!body.email,
      hasTurnstileToken: !!body.turnstileToken
    });

    // Verify Turnstile token
    const clientIP = request.headers.get('CF-Connecting-IP') || undefined;
    console.log('[contact] Verifying Turnstile', { clientIP, hasSecretKey: !!env.TURNSTILE_SECRET_KEY });

    const turnstileValid = await verifyTurnstile(
      body.turnstileToken,
      env.TURNSTILE_SECRET_KEY,
      clientIP
    );
    console.log('[contact] Turnstile result:', turnstileValid);

    if (!turnstileValid) {
      console.log('[contact] Turnstile verification failed');
      return errorResponse('CAPTCHA verification failed. Please try again.', 403);
    }

    // Validate message
    const messageValidation = validateMessage(body.message);
    console.log('[contact] Message validation:', messageValidation);
    if (!messageValidation.valid) {
      return errorResponse(messageValidation.error!);
    }

    // Validate submission type
    console.log('[contact] Validating submission type:', body.submission_type);
    if (!isValidSubmissionType(body.submission_type)) {
      console.log('[contact] Invalid submission type');
      return errorResponse('Invalid submission type');
    }

    // Validate email if provided
    if (body.email) {
      const emailValid = isValidEmail(body.email);
      console.log('[contact] Email validation:', { email: body.email, valid: emailValid });
      if (!emailValid) {
        return errorResponse('Invalid email format');
      }
    }

    // Store in D1
    console.log('[contact] Storing in D1...');
    await storeContactSubmission(
      env,
      body.submission_type,
      body.message.trim(),
      body.name,
      body.email
    );
    console.log('[contact] Stored in D1 successfully');

    // Send notification email (don't await - fire and forget)
    console.log('[contact] Sending notification email...');
    notifyContactSubmission(
      body.submission_type,
      body.message.trim(),
      body.name,
      body.email
    ).catch(err => console.error('[contact] Notification failed:', err));

    const response: ApiResponse = {
      success: true,
      message: 'Thank you for your submission. We will review it within 48 hours.'
    };
    console.log('[contact] Success, returning response');
    return jsonResponse(response);

  } catch (error) {
    console.error('[contact] Error:', error);
    console.error('[contact] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return errorResponse('Failed to process submission. Please try again.', 500);
  }
}
