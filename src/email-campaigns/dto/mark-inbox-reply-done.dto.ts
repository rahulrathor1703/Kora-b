import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { EmailCampaignReplyCategory } from '../entities/email-campaign-recipient.entity';
import { EMAIL_INBOX_REPLY_CATEGORIES } from './email-inbox-query.dto';

export class MarkInboxReplyDoneDto {
  @IsIn(EMAIL_INBOX_REPLY_CATEGORIES)
  replyCategory!: EmailCampaignReplyCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
