import crypto from 'crypto';
import { kdb } from '../infrastructure/db';
import { sendMail, isMailerConfigured } from './mailer';

/**
 * Email-verification / account activation.
 *
 * Lifecycle for an account created by an authorised user:
 *   1. the row is inserted with `activated_at = NULL` (pending);
 *   2. a single-use token is minted, stored ONLY as a SHA-256 digest, and emailed;
 *   3. the recipient opens the link, `POST /api/auth/activate` matches the digest,
 *      stamps `activated_at`, bumps `token_version` (kills any session minted for
 *      the pending account) and clears the token columns.
 *
 * Token handling rules:
 *   - 32 random bytes, hex encoded, compared by digest only — the plaintext token
 *     exists in the URL and in the recipient's inbox, never in the database;
 *   - `timingSafeEqual` on equal-length buffers for the digest comparison;
 *   - expiry is enforced server-side; an expired link can be re-sent;
 *   - issuing a new token invalidates the previous one.
 */

const ACTIVATION_TTL_DAYS = 7;

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير التطبيق',
  bishop: 'أسقف',
  supervisor: 'مشرف',
  priest: 'كاهن',
  student: 'طالب',
  parent: 'ولي أمر',
  monitor: 'مؤسس',
  employee: 'موظف',
  assistant_supervisor: 'مشرف مساعد',
};

function roleLabel(role: string | null | undefined): string {
  if (!role) return 'مستخدم';
  return ROLE_LABELS[role] || role;
}

/** Base URL used to build the activation link shown to the recipient. */
function appBaseUrl(): string {
  const explicit = (process.env.PUBLIC_APP_URL || '').trim();
  if (explicit) return explicit.replace(/\/+$/, '');

  // Fall back to the configured CORS origin so a single-domain deployment works
  // without extra configuration.
  const cors = (process.env.CORS_ORIGIN || '').trim();
  if (cors && cors !== '*') return cors.split(',')[0].trim().replace(/\/+$/, '');

  return 'http://localhost:5173';
}

export function buildActivationUrl(token: string): string {
  return `${appBaseUrl()}/?activate=${encodeURIComponent(token)}`;
}

export function hashActivationToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function newActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function expiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + ACTIVATION_TTL_DAYS);
  return d;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function activationEmail(params: { name: string; role: string; tenantName: string | null; url: string; days: number }) {
  const name = escapeHtml(params.name);
  const role = escapeHtml(roleLabel(params.role));
  const tenant = params.tenantName ? escapeHtml(params.tenantName) : 'حساب شخصي';

  const text = [
    `أهلاً ${params.name}،`,
    '',
    `تم إنشاء حساب لك في تطبيق سكني بصفة: ${roleLabel(params.role)} (${tenant}).`,
    '',
    'لتفعيل حسابك والدخول لأول مرة، افتح الرابط التالي:',
    params.url,
    '',
    `الرابط صالح لمدة ${params.days} أيام ويمكن استخدامه مرة واحدة فقط.`,
    'إذا لم تطلب إنشاء هذا الحساب، تجاهل هذه الرسالة.',
  ].join('\n');

  const html = `<!doctype html>
<html dir="rtl" lang="ar">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#0f172a;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:linear-gradient(135deg,#0f766e,#1e3a8a);padding:28px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:22px;">سكني</h1>
        <p style="margin:6px 0 0;color:#dbeafe;font-size:14px;">تفعيل حسابك</p>
      </div>
      <div style="padding:28px 24px;">
        <p style="margin:0 0 12px;font-size:16px;">أهلاً <strong>${name}</strong>،</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">
          تم إنشاء حساب لك في تطبيق <strong>سكني</strong> بصفة:
          <strong>${role}</strong> — ${tenant}.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.8;">
          اضغط الزر بالأسفل لتفعيل حسابك. بعد التفعيل ستتمكن من تسجيل الدخول بكلمة المرور التي حددها لك المسؤول.
        </p>
        <div style="text-align:center;margin:0 0 24px;">
          <a href="${params.url}"
             style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">
            تفعيل الحساب
          </a>
        </div>
        <p style="margin:0 0 8px;font-size:13px;color:#475569;line-height:1.7;">
          إذا لم يعمل الزر، انسخ هذا الرابط وافتحه في متصفحك:
        </p>
        <p style="margin:0 0 24px;font-size:12px;color:#0f766e;word-break:break-all;direction:ltr;text-align:left;">
          ${escapeHtml(params.url)}
        </p>
        <p style="margin:0;font-size:13px;color:#64748b;line-height:1.7;">
          الرابط صالح لمدة ${params.days} أيام ويمكن استخدامه مرة واحدة فقط.
          إذا لم تطلب إنشاء هذا الحساب، تجاهل هذه الرسالة.
        </p>
      </div>
    </div>
  </body>
</html>`;

  return { text, html };
}

export interface IssueActivationResult {
  ok: boolean;
  emailed: boolean;
  reason?: string;
}

/**
 * Mints a fresh activation token for `userId`, persists only its digest, then
 * emails the plaintext link. Returns `emailed:false` (never throws) so the caller
 * can still report a successful account creation.
 */
export async function issueActivationInvite(
  userId: string,
  opts: { send?: boolean } = {},
): Promise<IssueActivationResult> {
  const user = await kdb('users')
    .select('id', 'email', 'name', 'role', 'tenant_id', 'activated_at')
    .where({ id: userId })
    .first();

  if (!user) return { ok: false, emailed: false, reason: 'user-not-found' };
  if (user.activated_at) return { ok: false, emailed: false, reason: 'already-activated' };

  const token = newActivationToken();
  const now = new Date();
  const expires = expiryDate();

  await kdb('users')
    .where({ id: userId })
    .update({
      activation_token_hash: hashActivationToken(token),
      activation_expires_at: expires,
      activation_sent_at: now,
    });

  if (opts.send === false) return { ok: true, emailed: false };

  const tenantName = user.tenant_id
    ? (await kdb('tenants').select('name').where({ id: user.tenant_id }).first())?.name || null
    : null;

  const url = buildActivationUrl(token);
  const mail = activationEmail({
    name: user.name || user.email,
    role: user.role,
    tenantName,
    url,
    days: ACTIVATION_TTL_DAYS,
  });

  const result = await sendMail({
    to: user.email,
    subject: 'تفعيل حسابك في تطبيق سكني',
    text: mail.text,
    html: mail.html,
  });

  return { ok: true, emailed: result.sent, reason: result.error };
}

export function isMailerReady(): boolean {
  return isMailerConfigured();
}

export interface BulkActivationResult {
  /** Accounts handed in (duplicates removed). */
  total: number;
  /** Accounts the invite was actually delivered to. */
  emailed: number;
  /** Accounts skipped: already activated, unknown id, or delivery failed. */
  skipped: number;
}

/**
 * Fan-out variant of `issueActivationInvite` for bulk flows (tenant import).
 *
 * Runs with a small concurrency window so a 300-account import cannot open 300
 * SMTP sockets at once, and NEVER throws: a single bad address must not abort
 * the batch or roll back accounts that are already persisted.
 */
export async function issueActivationInvites(
  userIds: readonly string[],
  opts: { concurrency?: number } = {},
): Promise<BulkActivationResult> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return { total: 0, emailed: 0, skipped: 0 };

  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 5, unique.length));
  let emailed = 0;

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(async (userId) => {
        try {
          return await issueActivationInvite(userId);
        } catch (error: any) {
          console.error('[activation] bulk invite failed for', userId, error?.message || error);
          return { ok: false, emailed: false } as IssueActivationResult;
        }
      }),
    );
    for (const result of results) {
      if (result.emailed) emailed += 1;
    }
  }

  return { total: unique.length, emailed, skipped: unique.length - emailed };
}

export type ActivationLookup =
  | { state: 'valid'; userId: string }
  | { state: 'invalid' }
  | { state: 'expired' }
  | { state: 'already-activated' };

/** Resolves a plaintext token to its owner without mutating anything. */
export async function resolveActivationToken(token: string): Promise<ActivationLookup> {
  if (!token || typeof token !== 'string' || token.length < 32) return { state: 'invalid' };

  const digest = Buffer.from(hashActivationToken(token), 'hex');
  const user = await kdb('users')
    .select('id', 'activated_at', 'activation_token_hash', 'activation_expires_at')
    .where({ activation_token_hash: hashActivationToken(token) })
    .first();

  if (!user || !user.activation_token_hash) return { state: 'invalid' };

  // Constant-time confirmation that the stored digest really matches.
  const stored = Buffer.from(String(user.activation_token_hash), 'hex');
  if (stored.length !== digest.length || !crypto.timingSafeEqual(stored, digest)) {
    return { state: 'invalid' };
  }

  if (user.activated_at) return { state: 'already-activated' };
  if (!user.activation_expires_at || new Date(user.activation_expires_at).getTime() < Date.now()) {
    return { state: 'expired' };
  }

  return { state: 'valid', userId: user.id };
}

/**
 * Consumes a valid token: stamps `activated_at`, clears the token columns and
 * bumps `token_version` so any JWT issued before activation stops working.
 */
export async function consumeActivationToken(userId: string): Promise<boolean> {
  const result = await kdb('users')
    .where({ id: userId })
    .update({
      activated_at: new Date(),
      activation_token_hash: null,
      activation_expires_at: null,
      activation_sent_at: null,
    });

  if (!result) return false;

  await kdb('users')
    .where({ id: userId })
    .increment('token_version', 1);

  return true;
}

/** Human-readable copy for each activation outcome. */
export const ACTIVATION_MESSAGES = {
  invalid: 'رابط التفعيل غير صالح. اطلب إرسال رسالة تفعيل جديدة.',
  expired: 'انتهت صلاحية رابط التفعيل. اطلب إرسال رسالة تفعيل جديدة.',
  alreadyActivated: 'هذا الحساب مُفعّل بالفعل. يمكنك تسجيل الدخول مباشرة.',
  notConfigured: 'إرسال البريد غير مُهيأ حالياً. راجع المشرف لإرسال التفعيل يدوياً.',
};
