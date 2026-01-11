/**
 * Simple logger that can be enabled/disabled via environment variable
 *
 * Set ENABLE_LOGGING=true in wrangler.toml or Cloudflare dashboard to enable
 */

let loggingEnabled = false;

export function initLogger(enabled: string | undefined): void {
  loggingEnabled = enabled === 'true';
}

export function log(prefix: string, message: string, data?: Record<string, unknown>): void {
  if (!loggingEnabled) return;
  if (data) {
    console.log(`[${prefix}] ${message}`, data);
  } else {
    console.log(`[${prefix}] ${message}`);
  }
}

export function error(prefix: string, message: string, err?: unknown): void {
  // Errors always log regardless of setting
  console.error(`[${prefix}] ${message}`, err);
}
