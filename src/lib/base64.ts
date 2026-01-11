/**
 * Base64 encoding/decoding utilities
 */

/**
 * Decode base64 string to Uint8Array
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode Uint8Array to base64 string
 */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Safely decode base64, returning null on error
 */
export function safeDecodeBase64(base64: string): Uint8Array | null {
  try {
    return decodeBase64(base64);
  } catch {
    return null;
  }
}
