import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ProviderValidationInput,
  ProviderValidationResult,
} from './mailbox-provider.types';
import {
  getOutlookSmtpHosts,
  OUTLOOK_M365_SMTP_PRESET,
  OUTLOOK_PERSONAL_SMTP_PRESET,
} from './provider-smtp-presets';
import { normalizeAppPassword } from './mailbox-password.util';
import {
  mapSmtpVerificationErrorMessage,
  SmtpVerificationError,
  verifySmtpConnection,
} from './smtp-verify.util';

function asSmtpVerificationError(error: unknown): SmtpVerificationError {
  if (error instanceof SmtpVerificationError) {
    return error;
  }

  return new SmtpVerificationError('SMTP verification failed');
}

@Injectable()
export class OutlookProviderAdapter {
  async validate(
    input: ProviderValidationInput,
  ): Promise<ProviderValidationResult> {
    const email = input.email?.trim().toLowerCase();
    const password = normalizeAppPassword(input.appPassword?.trim() ?? '');

    if (!email) {
      throw new BadRequestException('Sender email is required');
    }

    if (!password) {
      throw new BadRequestException('Outlook app password is required');
    }

    if (password.length !== 16) {
      throw new BadRequestException(
        'Outlook app password must be 16 characters',
      );
    }

    const hosts = getOutlookSmtpHosts(email);
    let connectedHost: string | null = null;
    let lastError: SmtpVerificationError | null = null;

    for (const host of hosts) {
      try {
        await verifySmtpConnection({
          host,
          port: OUTLOOK_M365_SMTP_PRESET.port,
          secure: OUTLOOK_M365_SMTP_PRESET.secure,
          user: email,
          password,
        });
        connectedHost = host;
        break;
      } catch (error: unknown) {
        lastError = asSmtpVerificationError(error);
      }
    }

    if (!connectedHost) {
      throw new BadRequestException(
        lastError
          ? mapSmtpVerificationErrorMessage(lastError, 'Outlook')
          : 'Could not connect to Outlook. Check your email and app password, then try again.',
      );
    }

    const preset =
      connectedHost === OUTLOOK_PERSONAL_SMTP_PRESET.host
        ? OUTLOOK_PERSONAL_SMTP_PRESET
        : OUTLOOK_M365_SMTP_PRESET;

    return {
      email,
      syncStatus: 'connected',
      credentials: {
        type: 'outlook',
        password,
        authMethod: 'smtp',
      },
      smtpHost: preset.host,
      smtpPort: preset.port,
      smtpUser: email,
      smtpSecure: preset.secure,
    };
  }
}
