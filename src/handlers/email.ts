import type { Env } from '../types';
import { notifyEmailReceived } from '../lib/email';
import { decodeBase64 } from '../lib/base64';
import { storeUpload, storeContactSubmission } from '../lib/storage';
import { sanitizeFilename } from '../lib/validation';

interface ParsedEmail {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments: EmailAttachment[];
}

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Uint8Array;
}

async function parseEmail(message: ForwardableEmailMessage): Promise<ParsedEmail> {
  const reader = message.raw.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }

  const rawEmail = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    rawEmail.set(chunk, offset);
    offset += chunk.length;
  }

  const emailText = new TextDecoder().decode(rawEmail);

  // Simple email parsing (for production, consider a library like postal-mime)
  const headerBodySplit = emailText.indexOf('\r\n\r\n');
  const headers = emailText.substring(0, headerBodySplit);
  const body = emailText.substring(headerBodySplit + 4);

  // Extract subject from headers
  const subjectMatch = headers.match(/^Subject:\s*(.+)$/mi);
  const subject = subjectMatch ? subjectMatch[1].trim() : '(no subject)';

  const attachments: EmailAttachment[] = [];

  // Check if multipart
  const boundaryMatch = headers.match(/boundary="?([^"\r\n]+)"?/i);

  let textBody = body;

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
      if (part.trim() === '' || part.trim() === '--') continue;

      const partHeaderEnd = part.indexOf('\r\n\r\n');
      if (partHeaderEnd === -1) continue;

      const partHeaders = part.substring(0, partHeaderEnd);
      const partBody = part.substring(partHeaderEnd + 4);

      const contentType = partHeaders.match(/Content-Type:\s*([^;\r\n]+)/i)?.[1]?.trim() || '';
      const contentDisposition = partHeaders.match(/Content-Disposition:\s*([^\r\n]+)/i)?.[1] || '';
      const filenameMatch = contentDisposition.match(/filename="?([^"\r\n;]+)"?/i);

      if (filenameMatch) {
        // This is an attachment
        const filename = sanitizeFilename(filenameMatch[1]);
        const isBase64 = partHeaders.toLowerCase().includes('base64');

        let content: Uint8Array;
        if (isBase64) {
          const base64Content = partBody.replace(/\s/g, '');
          content = decodeBase64(base64Content);
        } else {
          content = new TextEncoder().encode(partBody);
        }

        attachments.push({ filename, contentType, content });
      } else if (contentType.startsWith('text/plain')) {
        textBody = partBody.trim();
      }
    }
  }

  return {
    from: message.from,
    to: message.to,
    subject,
    body: textBody.trim(),
    attachments
  };
}

function determineSubmissionType(email: string, subject: string): string {
  const lowerEmail = email.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  // Check email address first
  if (lowerEmail.includes('tip')) return 'tip';
  if (lowerEmail.includes('media') || lowerEmail.includes('press')) return 'media';
  if (lowerEmail.includes('correction')) return 'correction';
  if (lowerEmail.includes('evidence') || lowerEmail.includes('document')) return 'document';
  if (lowerEmail.includes('general') || lowerEmail.includes('contact')) return 'general';

  // Fall back to subject line
  if (lowerSubject.includes('tip')) return 'tip';
  if (lowerSubject.includes('media') || lowerSubject.includes('press')) return 'media';
  if (lowerSubject.includes('correction')) return 'correction';
  if (lowerSubject.includes('document') || lowerSubject.includes('evidence')) return 'document';

  return 'general';
}

export async function handleEmail(
  message: ForwardableEmailMessage,
  env: Env
): Promise<void> {
  try {
    const parsed = await parseEmail(message);

    // Determine submission type based on recipient/subject
    const submissionType = determineSubmissionType(parsed.to, parsed.subject);

    // Store email body as contact submission
    const messageContent = `[Email from: ${parsed.from}]\n[Subject: ${parsed.subject}]\n\n${parsed.body}`;

    await storeContactSubmission(
      env,
      submissionType,
      messageContent,
      null,
      parsed.from
    );

    // Process attachments as uploads using unified storage
    for (const attachment of parsed.attachments) {
      await storeUpload(env, attachment.content, {
        filename: attachment.filename,
        mimeType: attachment.contentType,
        size: attachment.content.length,
        source: 'email',
        emailFrom: parsed.from,
        emailSubject: parsed.subject,
      });
    }

    // Send notification email (don't await - fire and forget)
    notifyEmailReceived(
      parsed.from,
      parsed.to,
      parsed.subject,
      parsed.body,
      parsed.attachments.length
    ).catch(err => console.error('Notification failed:', err));

    console.log(`Processed email from ${parsed.from} with ${parsed.attachments.length} attachments`);

  } catch (error) {
    console.error('Email processing error:', error);
    // Don't reject - we don't want emails bouncing
  }
}
