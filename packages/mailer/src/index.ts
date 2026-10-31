import nodemailer from 'nodemailer';

// Outbound email transport, shared by the two senders in the app: project
// notifications (credentials per project) and authentication mail (credentials per
// instance). Only the transport lives here. Where the credentials come from, how
// they are stored, and what the message says belong to the caller.

const HTTP_TIMEOUT_MS = 15_000;

// Microsoft 365 refuses a password once the mailbox has MFA, and is retiring password
// SMTP altogether. 'microsoft365' signs in as an app registration (client credentials,
// permission SMTP.SendAsApp) and presents the token over XOAUTH2 as `username`.
export type SmtpAuth = 'password' | 'microsoft365';

export interface MicrosoftOAuthConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number | null;
  encryption: 'none' | 'ssl' | 'tls';
  username: string;
  password: string;
  timeout: number | null;
  // Absent on configs stored before it existed: those are password ones.
  auth?: SmtpAuth;
  oauth?: MicrosoftOAuthConfig;
}

export interface ResendConfig {
  enabled: boolean;
  apiKey: string;
}

export interface EmailConfig {
  smtp: SmtpConfig;
  resend: ResendConfig;
  // The From address. Falls back to EMAIL_FROM, then to the SMTP username.
  from?: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export interface SendResult {
  ok: boolean;
  // Only meaningful when ok is false: true for a transient failure worth retrying
  // (network error, timeout, rate limit, server error), false for a permanent one
  // (bad credentials, rejected recipient, misconfiguration).
  retryable?: boolean;
  error?: string;
}

// The From address for outbound email. An explicit config value wins, then the
// EMAIL_FROM env var; for SMTP the username (usually the account's own address) is
// the last fallback. Resend has no natural fallback: it needs a verified sender.
function fromAddress(config: EmailConfig, provider: 'smtp' | 'resend'): string | null {
  if (config.from && config.from.length > 0) return config.from;
  const env = process.env.EMAIL_FROM ?? process.env.NOTIFICATIONS_EMAIL_FROM;
  if (env && env.length > 0) return env;
  if (provider === 'smtp' && config.smtp.username.length > 0) return config.smtp.username;
  return null;
}

class TokenError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

// A token lasts about an hour; reusing it spares Microsoft a sign-in per message.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();
const TOKEN_MARGIN_MS = 60_000;

async function microsoftAccessToken(oauth: MicrosoftOAuthConfig): Promise<string> {
  const key = `${oauth.tenantId}|${oauth.clientId}|${oauth.clientSecret}`;
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt - TOKEN_MARGIN_MS > Date.now()) return cached.token;

  let res: Response;
  try {
    res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(oauth.tenantId)}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: oauth.clientId,
          client_secret: oauth.clientSecret,
          scope: 'https://outlook.office365.com/.default',
        }),
      },
    );
  } catch (err) {
    throw new TokenError(
      err instanceof Error ? err.message : 'microsoft token request failed',
      true,
    );
  }
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    const retryable = res.status >= 500 || res.status === 429;
    // A 4xx is a wrong tenant, client or secret, or a missing grant: retrying will not fix it.
    const reason = retryable
      ? 'microsoft token request failed'
      : 'microsoft refused the credentials';
    throw new TokenError(
      `${reason} (${res.status}): ${body.error_description ?? 'no description'}`,
      retryable,
    );
  }
  tokenCache.set(key, {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  });
  return body.access_token;
}

async function smtpAuth(smtp: SmtpConfig) {
  if (smtp.auth === 'microsoft365') {
    if (!smtp.oauth) throw new TokenError('microsoft 365 app credentials are missing', false);
    return {
      type: 'OAuth2' as const,
      user: smtp.username,
      accessToken: await microsoftAccessToken(smtp.oauth),
    };
  }
  return smtp.username ? { user: smtp.username, pass: smtp.password } : undefined;
}

async function sendSmtp(
  smtp: SmtpConfig,
  message: EmailMessage,
  from: string,
): Promise<SendResult> {
  // The config stores the timeout in seconds, nodemailer takes milliseconds.
  const timeoutMs = smtp.timeout ? smtp.timeout * 1000 : undefined;
  let auth: Awaited<ReturnType<typeof smtpAuth>>;
  try {
    auth = await smtpAuth(smtp);
  } catch (err) {
    const retryable = err instanceof TokenError ? err.retryable : true;
    return { ok: false, retryable, error: err instanceof Error ? err.message : 'smtp auth failed' };
  }
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port ?? (smtp.encryption === 'ssl' ? 465 : 587),
    secure: smtp.encryption === 'ssl',
    requireTLS: smtp.encryption === 'tls',
    auth,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });
  try {
    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { ok: true };
  } catch (err) {
    // SMTP 5xx is a permanent rejection; a 4xx code, connection error, or timeout is
    // transient and worth retrying.
    const code = (err as { responseCode?: number }).responseCode;
    const retryable = !(typeof code === 'number' && code >= 500 && code < 600);
    return { ok: false, retryable, error: err instanceof Error ? err.message : 'smtp send failed' };
  }
}

async function sendResend(
  resend: ResendConfig,
  message: EmailMessage,
  from: string,
): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${resend.apiKey}`,
        'content-type': 'application/json',
        ...(message.idempotencyKey ? { 'idempotency-key': message.idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      retryable: res.status === 429 || res.status >= 500,
      error: `Resend HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (err) {
    return {
      ok: false,
      retryable: true,
      error: err instanceof Error ? err.message : 'resend request failed',
    };
  }
}

// True when the config has a usable provider. Callers use it to disable features
// that depend on outbound email instead of queuing mail that cannot be sent.
export function hasEmailProvider(config: EmailConfig): boolean {
  return (
    (config.smtp.enabled && config.smtp.host.length > 0) ||
    (config.resend.enabled && config.resend.apiKey.length > 0)
  );
}

// Sends one message with the first enabled provider: SMTP wins over Resend when
// both are on.
export async function sendEmail(config: EmailConfig, message: EmailMessage): Promise<SendResult> {
  if (!message.to) return { ok: false, retryable: false, error: 'no recipient' };
  const { smtp, resend } = config;
  if (smtp.enabled && smtp.host.length > 0) {
    const from = fromAddress(config, 'smtp');
    if (!from) return { ok: false, retryable: false, error: 'no From address for SMTP' };
    return sendSmtp(smtp, message, from);
  }
  if (resend.enabled && resend.apiKey.length > 0) {
    const from = fromAddress(config, 'resend');
    if (!from) return { ok: false, retryable: false, error: 'EMAIL_FROM is required for Resend' };
    return sendResend(resend, message, from);
  }
  return { ok: false, retryable: false, error: 'no email provider enabled' };
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EmailLayout {
  heading?: string;
  action?: string;
}

const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const CODE =
  "display: inline-block; font-family: 'Courier New', Courier, monospace; font-size: 12px; " +
  'background-color: #f3f3f3; padding: 4px 6px; border-radius: 3px; border: 1px solid #e9e9e9; ' +
  'word-break: break-all;';

// The logo is served by the web app the link points to; a message without a link
// shows the name instead.
function logoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return `${new URL(url).origin}/parsec-email-logo.png`;
  } catch {
    return null;
  }
}

function card(content: string, style: string): string {
  return `<table role="presentation" width="100%"><tr><td></td><td width="620" style="width: 620px; max-width: 620px;"><table role="presentation" width="100%" style="${style}"><tr><td style="padding: 24px;">${content}</td></tr></table></td><td></td></tr></table>`;
}

// Wraps a plain-text body (and an optional link) into the text/html pair the
// transport needs. Shared so every message in the app looks the same.
export function emailBody(
  text: string,
  url?: string | null,
  layout: EmailLayout = {},
): { text: string; html: string } {
  const plain = url ? `${text}\n\n${url}` : text;
  const logo = logoUrl(url);
  const brand = logo
    ? `<img src="${escape(logo)}" width="139" alt="Parsec" style="display: block; margin: 0 auto; height: auto;" />`
    : '<span style="color: #ffffff; font-size: 22px; font-weight: 600;">Parsec</span>';
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin: 0 0 16px;">${escape(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const heading = layout.heading
    ? `<h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.35; font-weight: 600; color: #111111;">${escape(layout.heading)}</h1>`
    : '';
  const link = url
    ? `<table role="presentation" style="margin: 8px 0 24px;"><tr><td><a href="${escape(url)}" target="_blank" style="background-color: #4f46e5; border-radius: 6px; color: #ffffff; padding: 12px 24px; text-decoration: none; display: inline-block; font-size: 16px; font-weight: 500;">${escape(layout.action ?? 'Open in Parsec')}</a></td></tr></table>` +
      '<p style="margin: 0; font-size: 13px; line-height: 1.6; color: #5f5e5e;">If the button does not work, copy this link into your browser:</p>' +
      `<p style="margin: 6px 0 0; font-size: 13px; line-height: 1.6;"><span style="${CODE}">${escape(url)}</span></p>`
    : '';
  const html =
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>' +
    `<body style="margin: 0; padding: 0; background-color: #f9f9f9; font-family: ${FONT}; color: #474747; -webkit-font-smoothing: antialiased;">` +
    '<center style="width: 100%; background-color: #f9f9f9; padding: 40px 0;">' +
    card(`<div style="text-align: center;">${brand}</div>`, 'background-color: #0b1120;') +
    card(
      `<div style="font-size: 16px; line-height: 1.5; color: #474747;">${heading}${paragraphs}${link}</div>`,
      'background-color: #ffffff; padding: 8px 16px;',
    ) +
    card(
      '<p style="margin: 0; font-size: 12px; line-height: 1.6; color: #979797;">Sent by Parsec, a fork of It&#39;s a Plan run by NAFDO.</p>',
      'background-color: #ffffff; padding: 0 16px 8px; border-top: 1px solid #e9e9e9;',
    ) +
    '</center></body></html>';
  return { text: plain, html };
}
