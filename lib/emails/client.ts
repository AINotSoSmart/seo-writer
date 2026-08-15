import { Resend } from 'resend';

// Initialize Resend with API key from environment variables
// Falls back to empty string to prevent build errors, but will fail at runtime if missing
export const resend = new Resend(process.env.RESEND_API_KEY || '');

// Using verified domain sub-domain for better deliverability
export const EMAIL_FROM = process.env.EMAIL_FROM || 'Harvansh at FlipAEO <harvansh@support.flipaeo.com>';
export const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@flipaeo.com';
