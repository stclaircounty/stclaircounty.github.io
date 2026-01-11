/**
 * Cloudflare Turnstile verification
 *
 * Setup:
 * 1. Create a Turnstile widget at https://dash.cloudflare.com/turnstile
 * 2. Add the site key to your frontend forms
 * 3. Add the secret key to wrangler.toml or Cloudflare dashboard secrets
 */

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
  console.log('[turnstile] Verifying token', {
    tokenLength: token?.length,
    hasSecretKey: !!secretKey,
    secretKeyLength: secretKey?.length,
    remoteIp
  });

  if (!token || !secretKey) {
    console.error('[turnstile] Missing token or secret key', { hasToken: !!token, hasSecretKey: !!secretKey });
    return false;
  }

  try {
    const formData = new FormData();
    formData.append('secret', secretKey);
    formData.append('response', token);
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    console.log('[turnstile] Sending verification request to Cloudflare');
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body: formData,
    });

    console.log('[turnstile] Response status:', response.status);
    const result: TurnstileVerifyResponse = await response.json();
    console.log('[turnstile] Response body:', JSON.stringify(result));

    if (!result.success) {
      console.error('[turnstile] Verification failed:', result['error-codes']);
      return false;
    }

    console.log('[turnstile] Verification successful');
    return true;
  } catch (error) {
    console.error('[turnstile] Verification error:', error);
    console.error('[turnstile] Error stack:', error instanceof Error ? error.stack : 'no stack');
    return false;
  }
}
