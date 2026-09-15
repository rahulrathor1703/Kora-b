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
import type { EmailCampaignEventType } from '../entities/email-campaign-event.entity';

export const CAMPAIGN_EVENT_TYPE_FILTERS = [
  'sent',
  'open',
  'click',
  'bounce',
  'send_failed',
  'reply',
  'unsubscribe',
] as const satisfies readonly EmailCampaignEventType[];

export class CampaignEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_EVENT_TYPE_FILTERS)
  eventType?: EmailCampaignEventType;

  @IsOptional()
  @IsUUID()
  recipientId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepOrder?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}

export class RecipientEventsQueryDto {
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
  limit?: number = 100;
}
