import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { EmailCampaignDeleteRequestStatus } from '../entities/email-campaign-delete-request.entity';

const DELETE_REQUEST_STATUSES: EmailCampaignDeleteRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

export class CreateEmailCampaignDeleteRequestDto {
  @IsUUID()
  campaignId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class EmailCampaignDeleteRequestsQueryDto {
  @IsOptional()
  @IsIn(DELETE_REQUEST_STATUSES)
  status?: EmailCampaignDeleteRequestStatus;

  @IsOptional()
  @IsUUID()
  campaignId?: string;
}

export class RejectEmailCampaignDeleteRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
