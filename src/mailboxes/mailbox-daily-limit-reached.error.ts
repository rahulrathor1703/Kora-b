import { BadRequestException } from '@nestjs/common';

export class MailboxDailyLimitReachedError extends BadRequestException {
  constructor() {
    super('Mailbox daily send limit reached');
  }
}
