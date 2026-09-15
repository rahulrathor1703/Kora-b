import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { EmailCampaignReplyCategory } from '../entities/email-campaign-recipient.entity';

export const EMAIL_INBOX_REPLY_CATEGORIES = [
  'interested',
  'not_now',
  'no',
  'ooo',
  'wrong_person',
] as const satisfies readonly EmailCampaignReplyCategory[];

export class EmailInboxQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsIn(EMAIL_INBOX_REPLY_CATEGORIES)
  replyCategory?: EmailCampaignReplyCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;
}
