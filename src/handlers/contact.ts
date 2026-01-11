import type { Env, ContactSubmission, ApiResponse } from '../types';
import { jsonResponse, errorResponse } from '../middleware';
import { notifyContactSubmission } from '../lib/email';
import { isValidEmail, isValidSubmissionType, validateMessage } from '../lib/validation';
import { storeContactSubmission } from '../lib/storage';
import { verifyTurnstile } from '../lib/turnstile';

export async function handleContact(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body: ContactSubmission = await request.json();

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

    // Validate message
    const messageValidation = validateMessage(body.message);
    if (!messageValidation.valid) {
      return errorResponse(messageValidation.error!);
    }

    // Validate submission type
    if (!isValidSubmissionType(body.submission_type)) {
      return errorResponse('Invalid submission type');
    }

    // Validate email if provided
    if (body.email && !isValidEmail(body.email)) {
      return errorResponse('Invalid email format');
    }

    // Store in D1
    await storeContactSubmission(
      env,
      body.submission_type,
      body.message.trim(),
      body.name,
      body.email
    );

    // Send notification email (don't await - fire and forget)
    notifyContactSubmission(
      body.submission_type,
      body.message.trim(),
      body.name,
      body.email
    ).catch(err => console.error('Notification failed:', err));

    const response: ApiResponse = {
      success: true,
      message: 'Thank you for your submission. We will review it within 48 hours.'
    };
    return jsonResponse(response);

  } catch (error) {
    console.error('Contact form error:', error);
    return errorResponse('Failed to process submission. Please try again.', 500);
  }
}
