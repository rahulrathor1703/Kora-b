import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface InviteEmailPayload {
  to: string;
  inviteUrl: string;
  roleName: string;
  hierarchyLevel: number;
  invitedByEmail: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_TIMEOUT_MS = 20_000;

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOtpEmail(to: string, code: string): Promise<void> {
    await this.deliverEmail({
      to,
      subject: 'Your Markos verification code',
      text: [
        'Your Markos verification code is:',
        '',
        code,
        '',
        'This code expires in 10 minutes.',
        'If you did not request this, you can ignore this email.',
      ].join('\n'),
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
          <p style="font-size: 16px; margin-bottom: 24px;">Your Markos verification code is:</p>
          <p style="font-size: 32px; font-weight: 700; letter-spacing: 0.35em; margin: 0 0 24px;">${code}</p>
          <p style="font-size: 14px; color: #475569; margin: 0;">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });
  }

  async sendInviteEmail(payload: InviteEmailPayload): Promise<void> {
    await this.deliverEmail({
      to: payload.to,
      subject: 'You have been invited to join a Markos workspace',
      text: [
        `${payload.invitedByEmail} invited you to join their Markos workspace.`,
        '',
        `Role: ${payload.roleName}`,
        `Hierarchy level: ${payload.hierarchyLevel}`,
        '',
        `Accept your invitation: ${payload.inviteUrl}`,
      ].join('\n'),
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #0f172a;">
          <p style="font-size: 16px;">${payload.invitedByEmail} invited you to join their Markos workspace.</p>
          <p style="font-size: 14px; color: #475569;">Role: ${payload.roleName} · Level ${payload.hierarchyLevel}</p>
          <p style="margin-top: 24px;"><a href="${payload.inviteUrl}" style="color: #4338CA; font-weight: 600;">Accept invitation</a></p>
        </div>
      `,
    });
  }

  private async deliverEmail(message: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    const from = this.config.get<string>('smtp.from') ?? 'noreply@markos.dev';
    const resendApiKey = this.config.get<string>('resend.apiKey')?.trim();

    if (resendApiKey) {
      await this.sendViaResend({ ...message, from, apiKey: resendApiKey });
      return;
    }

    const transporter = this.getTransporter();

    try {
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      throw new InternalServerErrorException(
        this.formatSmtpFailureMessage(error),
      );
    }
  }

  private formatSmtpFailureMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String((error as { code?: string }).code ?? '');
      if (code === 'ETIMEDOUT' || code === 'ESOCKET') {
        return 'Email could not be sent (SMTP connection timed out). On Render free tier, use RESEND_API_KEY instead of SMTP.';
      }
    }

    return 'Email could not be sent. Try again later or contact platform support.';
  }

  private async sendViaResend(payload: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
    apiKey: string;
  }): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: payload.from,
          to: [payload.to],
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new InternalServerErrorException(
          `Email could not be sent via Resend (${response.status}). ${detail.slice(0, 200)}`,
        );
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new InternalServerErrorException(
          'Email could not be sent (Resend request timed out).',
        );
      }

      throw new InternalServerErrorException(
        'Email could not be sent via Resend. Try again later or contact platform support.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private getTransporter(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.config.get<string>('smtp.host');
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');

    if (!host || !user || !pass) {
      throw new InternalServerErrorException(
        'Email service is not configured. Contact platform support.',
      );
    }

    const port = this.config.get<number>('smtp.port') ?? 587;
    const secure = this.config.get<boolean>('smtp.secure') ?? false;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS: !secure && port === 587,
      auth: { user, pass },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 20_000,
    });

    return this.transporter;
  }
}
