import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const CAMPAIGN_RECIPIENT_STATUS_FILTERS = [
  'pending',
  'sent',
  'opened',
  'clicked',
  'bounced',
  'replied',
] as const;

export type CampaignRecipientStatusFilter =
  (typeof CAMPAIGN_RECIPIENT_STATUS_FILTERS)[number];

export const CAMPAIGN_RECIPIENT_DISPOSITION_FILTERS = [
  'eligible',
  'excluded',
  'paused',
  'stopped',
  'unsubscribed',
  'done',
] as const;

export type CampaignRecipientDispositionFilter =
  (typeof CAMPAIGN_RECIPIENT_DISPOSITION_FILTERS)[number];

export class CampaignRecipientsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_RECIPIENT_STATUS_FILTERS)
  status?: CampaignRecipientStatusFilter;

  @IsOptional()
  @IsIn(CAMPAIGN_RECIPIENT_DISPOSITION_FILTERS)
  disposition?: CampaignRecipientDispositionFilter;

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
