/**
 * Email sending via MailChannels (free for Cloudflare Workers)
 *
 * Requirements:
 * 1. Add SPF record: v=spf1 a mx include:relay.mailchannels.net ~all
 * 2. Add Domain Lockdown TXT record to prevent spoofing:
 *    _mailchannels.stclaircounty.net TXT "v=mc1 cfid=stclaircounty-net"
 */

import { NOTIFICATION_EMAIL, FROM_EMAIL, FROM_NAME, formatFileSize } from './config';
import { escapeHtml, escapeHtmlWithBreaks } from './html';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

// Shared email CSS styles
const EMAIL_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a2e; }
  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
  .header { background: linear-gradient(135deg, #1a1a2e, #334155); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
  .content { background: #f8fafc; padding: 20px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; }
  .field { margin-bottom: 16px; }
  .label { font-weight: 600; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { margin-top: 4px; }
  .message-box { background: white; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-top: 8px; white-space: pre-wrap; word-wrap: break-word; }
  .footer { margin-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-red { background: #dc2626; color: white; }
  .badge-green { background: #059669; color: white; }
  .badge-blue { background: #2563eb; color: white; }
  .badge-purple { background: #7c3aed; color: white; margin-left: 8px; }
  .file-info { display: flex; gap: 20px; }
  .file-info .field { flex: 1; }
  code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
`;

function emailTemplate(title: string, badgeClass: string, badgeText: string, content: string, extraBadge?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <style>${EMAIL_STYLES}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0 0 8px 0;">${escapeHtml(title)}</h2>
      <span class="badge ${badgeClass}">${escapeHtml(badgeText)}</span>
      ${extraBadge || ''}
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      St. Clair Under Oath - Automated Notification
    </div>
  </div>
</body>
</html>
  `.trim();
}

function field(label: string, value: string, isHtml = false): string {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="value">${isHtml ? value : escapeHtml(value)}</div>
    </div>
  `;
}

function messageBox(label: string, content: string): string {
  return `
    <div class="field">
      <div class="label">${escapeHtml(label)}</div>
      <div class="message-box">${escapeHtmlWithBreaks(content)}</div>
    </div>
  `;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject: options.subject,
        content: [
          {
            type: 'text/plain',
            value: options.text,
          },
          ...(options.html ? [{
            type: 'text/html',
            value: options.html,
          }] : []),
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Email send failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send error:', error);
    return false;
  }
}

export async function notifyContactSubmission(
  submissionType: string,
  message: string,
  name?: string,
  email?: string
): Promise<void> {
  const subject = `[Contact] New ${submissionType} submission`;

  const text = `
New contact form submission received.

Type: ${submissionType}
Name: ${name || '(anonymous)'}
Email: ${email || '(not provided)'}

Message:
${message}

---
St. Clair Under Oath - Automated Notification
  `.trim();

  const fromValue = name
    ? `${escapeHtml(name)}${email ? ` &lt;${escapeHtml(email)}&gt;` : ''}`
    : `<em>Anonymous</em>${email ? ` &lt;${escapeHtml(email)}&gt;` : ''}`;

  const content = `
    ${field('From', fromValue, true)}
    ${messageBox('Message', message)}
  `;

  const html = emailTemplate(
    'New Contact Submission',
    'badge-red',
    submissionType.toUpperCase(),
    content
  );

  await sendEmail({ to: NOTIFICATION_EMAIL, subject, text, html });
}

export async function notifyFileUpload(
  uploadId: string,
  filename: string,
  fileSize: number,
  description?: string,
  contactName?: string,
  contactEmail?: string
): Promise<void> {
  const subject = `[Upload] New file uploaded: ${filename}`;
  const sizeFormatted = formatFileSize(fileSize);

  const text = `
New file upload received.

Upload ID: ${uploadId}
Filename: ${filename}
Size: ${sizeFormatted}

Contact: ${contactName || '(anonymous)'} ${contactEmail ? `<${contactEmail}>` : ''}

Description:
${description || '(none provided)'}

---
St. Clair Under Oath - Automated Notification
  `.trim();

  const fromValue = contactName
    ? `${escapeHtml(contactName)}${contactEmail ? ` &lt;${escapeHtml(contactEmail)}&gt;` : ''}`
    : `<em>Anonymous</em>${contactEmail ? ` &lt;${escapeHtml(contactEmail)}&gt;` : ''}`;

  const content = `
    <div class="file-info">
      ${field('Filename', filename)}
      ${field('Size', sizeFormatted)}
    </div>
    ${field('Upload ID', `<code>${escapeHtml(uploadId)}</code>`, true)}
    ${field('From', fromValue, true)}
    ${description ? messageBox('Description', description) : ''}
  `;

  const html = emailTemplate(
    'New File Upload',
    'badge-green',
    'SECURE UPLOAD',
    content
  );

  await sendEmail({ to: NOTIFICATION_EMAIL, subject, text, html });
}

export async function notifyEmailReceived(
  from: string,
  to: string,
  emailSubject: string,
  body: string,
  attachmentCount: number
): Promise<void> {
  const notifySubject = `[Email] ${attachmentCount > 0 ? '📎 ' : ''}From: ${from}`;

  const text = `
New email received.

From: ${from}
To: ${to}
Subject: ${emailSubject}
Attachments: ${attachmentCount}

Body:
${body}

---
St. Clair Under Oath - Automated Notification
  `.trim();

  const extraBadge = attachmentCount > 0
    ? `<span class="badge badge-purple">${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}</span>`
    : '';

  const content = `
    ${field('From', from)}
    ${field('To', to)}
    ${field('Subject', emailSubject)}
    ${messageBox('Body', body)}
  `;

  const html = emailTemplate(
    'New Email Received',
    'badge-blue',
    'EMAIL',
    content,
    extraBadge
  );

  await sendEmail({ to: NOTIFICATION_EMAIL, subject: notifySubject, text, html });
}
