import nodemailer, { type Transporter } from 'nodemailer';

/**
 * Outbound SMTP transport.
 *
 * Defaults target Gmail (smtp.gmail.com:465, implicit TLS) so the deployment only
 * needs SMTP_USER / SMTP_PASS (a Google *App Password*, not the account password).
 *
 * Fail-soft by design: `sendMail` never throws. A misconfigured or unreachable
 * mailbox must not roll back a user that was already persisted, and must never
 * surface SMTP internals to an API caller.
 */

let cachedTransport: Transporter | null = null;

const boolEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

/** True when enough configuration exists to attempt delivery. */
export function isMailerConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransport(): Transporter {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = boolEnv(process.env.SMTP_SECURE, port === 465);

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return cachedTransport;
}

const fromAddress = (): string =>
  process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost';

export interface SendMailResult {
  sent: boolean;
  error?: string;
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<SendMailResult> {
  if (!isMailerConfigured()) {
    const error = 'SMTP is not configured (SMTP_USER / SMTP_PASS missing)';
    console.error('[mailer] skipped:', error);
    return { sent: false, error };
  }

  try {
    await getTransport().sendMail({
      from: fromAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    return { sent: true };
  } catch (error: any) {
    // Log the reason server-side only; callers get a generic "not sent" result.
    console.error('[mailer] send failed:', error?.message || error);
    return { sent: false, error: error?.message || String(error) };
  }
}

/** Test seam: drops the memoised transporter (used by unit tests). */
export function __resetMailerForTests(): void {
  cachedTransport = null;
}
