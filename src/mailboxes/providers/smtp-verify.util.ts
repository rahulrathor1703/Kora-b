import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { Transporter } from 'nodemailer';
import { GMAIL_SMTP_ATTEMPTS } from './provider-smtp-presets';

export interface SmtpConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  requireTls?: boolean;
  user: string;
  password: string;
}

export interface GmailConnectionResult {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export class SmtpVerificationError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly responseCode?: number,
    readonly response?: string,
  ) {
    super(message);
    this.name = 'SmtpVerificationError';
  }
}

function createSmtpTransport(options: SMTPTransport.Options): Transporter {
  return nodemailer.createTransport(options);
}

function toSmtpVerificationError(error: unknown): SmtpVerificationError {
  if (error instanceof SmtpVerificationError) {
    return error;
  }

  if (error && typeof error === 'object') {
    const smtpError = error as {
      message?: string;
      code?: string;
      responseCode?: number;
      response?: string;
    };

    return new SmtpVerificationError(
      smtpError.message ?? 'SMTP verification failed',
      smtpError.code,
      smtpError.responseCode,
      smtpError.response,
    );
  }

  return new SmtpVerificationError('SMTP verification failed');
}

async function verifyTransport(transport: Transporter): Promise<void> {
  try {
    await transport.verify();
  } catch (error) {
    throw toSmtpVerificationError(error);
  } finally {
    transport.close();
  }
}

export async function verifySmtpConnection(
  config: SmtpConnectionConfig,
): Promise<void> {
  const transport = createSmtpTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTls ?? (!config.secure && config.port === 587),
    auth: {
      user: config.user,
      pass: config.password,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  await verifyTransport(transport);
}

export async function verifyGmailConnection(
  user: string,
  password: string,
): Promise<GmailConnectionResult> {
  const attempts: Array<{
    result: GmailConnectionResult;
    createTransport: () => Transporter;
  }> = [
    {
      result: {
        smtpHost: 'smtp.gmail.com',
        smtpPort: 465,
        smtpSecure: true,
      },
      createTransport: () =>
        createSmtpTransport({
          service: 'gmail',
          auth: { user, pass: password },
          connectionTimeout: 15_000,
          greetingTimeout: 15_000,
          socketTimeout: 20_000,
        }),
    },
    ...GMAIL_SMTP_ATTEMPTS.map((preset) => ({
      result: {
        smtpHost: preset.host,
        smtpPort: preset.port,
        smtpSecure: preset.secure,
      },
      createTransport: () =>
        createSmtpTransport({
          host: preset.host,
          port: preset.port,
          secure: preset.secure,
          requireTLS:
            preset.requireTls ?? (!preset.secure && preset.port === 587),
          auth: { user, pass: password },
          connectionTimeout: 15_000,
          greetingTimeout: 15_000,
          socketTimeout: 20_000,
        }),
    })),
  ];

  let lastError: SmtpVerificationError | null = null;

  for (const attempt of attempts) {
    try {
      await verifyTransport(attempt.createTransport());
      return attempt.result;
    } catch (error: unknown) {
      lastError =
        error instanceof SmtpVerificationError
          ? error
          : toSmtpVerificationError(error);
    }
  }

  throw lastError ?? new SmtpVerificationError('SMTP verification failed');
}

export function mapSmtpVerificationErrorMessage(
  error: SmtpVerificationError,
  providerLabel: 'Gmail' | 'Outlook',
  passwordLength?: number,
): string {
  const code = error.code?.toUpperCase();
  const responseCode = error.responseCode;
  const response = error.response?.toLowerCase() ?? '';

  if (code === 'EAUTH' || responseCode === 535 || responseCode === 534) {
    if (passwordLength !== undefined && passwordLength !== 16) {
      return `${providerLabel} requires a 16-character App Password. Turn on 2-Step Verification on the sender account, create an App Password for Mail, and use that here.`;
    }

    if (response.includes('application-specific password')) {
      return `${providerLabel} requires an App Password. Create one in your account security settings and paste all 16 characters here.`;
    }

    if (response.includes('web browser') || response.includes('less secure')) {
      return `${providerLabel} blocked the login. Create an App Password for Mail and use that instead of your regular login password.`;
    }

    return `${providerLabel} rejected the email or app password. Double-check both are correct for the sender address you entered.`;
  }

  if (
    code === 'ETIMEDOUT' ||
    code === 'ECONNECTION' ||
    code === 'ESOCKET' ||
    code === 'ENOTFOUND'
  ) {
    return `Could not reach ${providerLabel} SMTP servers. Check your internet connection or firewall, then try again.`;
  }

  return `Could not connect to ${providerLabel}. Check the sender email and app password, then try again.`;
}
