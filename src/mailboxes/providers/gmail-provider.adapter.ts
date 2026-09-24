import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
  ProviderValidationInput,
  ProviderValidationResult,
} from './mailbox-provider.types';
import { normalizeAppPassword } from './mailbox-password.util';
import {
  mapSmtpVerificationErrorMessage,
  SmtpVerificationError,
  verifyGmailConnection,
} from './smtp-verify.util';

@Injectable()
export class GmailProviderAdapter {
  private readonly logger = new Logger(GmailProviderAdapter.name);

  async validate(
    input: ProviderValidationInput,
  ): Promise<ProviderValidationResult> {
    const email = input.email?.trim().toLowerCase();
    const password = normalizeAppPassword(input.appPassword?.trim() ?? '');

    if (!email) {
      throw new BadRequestException('Sender email is required');
    }

    if (!password) {
      throw new BadRequestException('Gmail app password is required');
    }

    if (password.length !== 16) {
      throw new BadRequestException('Gmail app password must be 16 characters');
    }

    try {
      const connection = await verifyGmailConnection(email, password);

      return {
        email,
        syncStatus: 'connected',
        credentials: {
          type: 'gmail',
          password,
          authMethod: 'smtp',
        },
        smtpHost: connection.smtpHost,
        smtpPort: connection.smtpPort,
        smtpUser: email,
        smtpSecure: connection.smtpSecure,
      };
    } catch (error: unknown) {
      const smtpError =
        error instanceof SmtpVerificationError
          ? error
          : new SmtpVerificationError('SMTP verification failed');

      this.logger.warn(
        `Gmail SMTP verification failed for ${email}: code=${smtpError.code ?? 'unknown'} responseCode=${smtpError.responseCode ?? 'unknown'}`,
      );

      throw new BadRequestException(
        mapSmtpVerificationErrorMessage(smtpError, 'Gmail', password.length),
      );
    }
  }
}
