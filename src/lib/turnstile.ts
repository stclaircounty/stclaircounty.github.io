/**
 * Cloudflare Turnstile verification
 *
 * Setup:
 * 1. Create a Turnstile widget at https://dash.cloudflare.com/turnstile
 * 2. Add the site key to your frontend forms
 * 3. Add the secret key to wrangler.toml or Cloudflare dashboard secrets
 */

import { log, error } from './logger';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * Verify a Turnstile token
 *
 * @param token - The token from the client-side widget
 * @param secretKey - Your Turnstile secret key
 * @param remoteIp - Optional client IP for additional verification
 * @returns true if valid, false otherwise
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
  remoteIp?: string
): Promise<boolean> {
  log('turnstile', 'Verifying token', {
    tokenLength: token?.length,
    hasSecretKey: !!secretKey,
    secretKeyLength: secretKey?.length,
    remoteIp
  });

  if (!token || !secretKey) {
    error('turnstile', 'Missing token or secret key', { hasToken: !!token, hasSecretKey: !!secretKey });
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    log('turnstile', 'Sending verification request to Cloudflare');
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    });

    log('turnstile', 'Response received', { status: response.status });
    const result: TurnstileVerifyResponse = await response.json();
    log('turnstile', 'Response body', { result: JSON.stringify(result) });

    if (!result.success) {
      error('turnstile', 'Verification failed', result['error-codes']);
      return false;
    }

    log('turnstile', 'Verification successful');
    return true;
  } catch (err) {
    error('turnstile', 'Verification error', err);
    return false;
  }
}
