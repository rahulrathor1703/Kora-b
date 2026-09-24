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

export const CAMPAIGN_AUDIENCE_DISPOSITION_FILTERS = [
  'all',
  'eligible',
  'excluded',
] as const;

export type CampaignAudienceDispositionFilter =
  (typeof CAMPAIGN_AUDIENCE_DISPOSITION_FILTERS)[number];

export class CampaignAudienceQueryDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsIn(CAMPAIGN_AUDIENCE_DISPOSITION_FILTERS)
  disposition?: CampaignAudienceDispositionFilter = 'all';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

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
