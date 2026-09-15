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

@Injectable()
export class MailService {
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {}

  async sendOtpEmail(to: string, code: string): Promise<void> {
    const transporter = this.getTransporter();
    const from = this.config.get<string>('smtp.from') ?? 'noreply@markos.dev';

    await transporter.sendMail({
      from,
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
    const transporter = this.getTransporter();
    const from = this.config.get<string>('smtp.from') ?? 'noreply@markos.dev';

    await transporter.sendMail({
      from,
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
      auth: { user, pass },
    });

    return this.transporter;
  }
}
