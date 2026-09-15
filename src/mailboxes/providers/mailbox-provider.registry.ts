import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ProviderValidationInput,
  ProviderValidationResult,
} from './mailbox-provider.types';
import { GmailProviderAdapter } from './gmail-provider.adapter';
import { OutlookProviderAdapter } from './outlook-provider.adapter';
import { SmtpProviderAdapter } from './smtp-provider.adapter';

@Injectable()
export class MailboxProviderRegistry {
  constructor(
    private readonly gmailAdapter: GmailProviderAdapter,
    private readonly outlookAdapter: OutlookProviderAdapter,
    private readonly smtpAdapter: SmtpProviderAdapter,
  ) {}

  validate(input: ProviderValidationInput): Promise<ProviderValidationResult> {
    switch (input.provider) {
      case 'gmail':
        return this.gmailAdapter.validate(input);
      case 'outlook':
        return this.outlookAdapter.validate(input);
      case 'smtp':
        return this.smtpAdapter.validate(input);
      default:
        throw new BadRequestException('Unsupported mailbox provider');
    }
  }
}
