import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ProviderValidationInput,
  ProviderValidationResult,
} from './mailbox-provider.types';
import { verifySmtpConnection } from './smtp-verify.util';

@Injectable()
export class SmtpProviderAdapter {
  async validate(
    input: ProviderValidationInput,
  ): Promise<ProviderValidationResult> {
    const host = input.smtpHost?.trim();
    const user = input.smtpUser?.trim();
    const password = input.smtpPassword?.trim();
    const port = input.smtpPort;
    const secure = Boolean(input.smtpSecure);
    const email = input.email?.trim().toLowerCase();

    if (!host) {
      throw new BadRequestException('SMTP host is required');
    }

    if (!user) {
      throw new BadRequestException('SMTP username is required');
    }

    if (!password) {
      throw new BadRequestException('SMTP password is required');
    }

    if (!email) {
      throw new BadRequestException('Sender email is required');
    }

    if (!port || port < 1 || port > 65535) {
      throw new BadRequestException('Enter a valid SMTP port (1–65535)');
    }

    try {
      await verifySmtpConnection({
        host,
        port,
        secure,
        user,
        password,
      });
    } catch {
      throw new BadRequestException(
        'SMTP connection failed. Check host, port, username, and password.',
      );
    }

    return {
      email,
      syncStatus: 'connected',
      credentials: {
        type: 'smtp',
        password,
      },
      smtpHost: host,
      smtpPort: port,
      smtpUser: user,
      smtpSecure: secure,
    };
  }
}
