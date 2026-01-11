/**
 * HTML utilities for safe content rendering
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => HTML_ENTITIES[char]);
}

/**
 * Escape HTML and convert newlines to <br> tags
 */
export function escapeHtmlWithBreaks(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}
