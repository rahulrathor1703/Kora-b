import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateSequenceStepDto {
  @IsInt()
  @Min(1)
  stepOrder!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsInt()
  @Min(0)
  @Max(90)
  delayDays!: number;

  @IsOptional()
  @IsIn(['relative', 'absolute'])
  delayMode?: 'relative' | 'absolute';

  @ValidateIf((step: CreateSequenceStepDto) => step.delayMode === 'absolute')
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'scheduledDate must be a date in YYYY-MM-DD format',
  })
  scheduledDate?: string;

  @IsOptional()
  @IsBoolean()
  includeSignature?: boolean;
}

export class CreateMailboxSenderDto {
  @IsUUID()
  mailboxId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  senderName!: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  senderEmail!: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsInt()
  @Min(1)
  @Max(500)
  dailySendQuota!: number;
}

export class CreateEmailCampaignDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsUUID()
  campaignTypeId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSequenceStepDto)
  steps!: CreateSequenceStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMailboxSenderDto)
  mailboxSenders?: CreateMailboxSenderDto[];

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string>;
}

export class ScheduleEmailCampaignDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'launchAt must be a date in YYYY-MM-DD format',
  })
  launchAt!: string;

  @IsInt()
  @Min(1)
  @Max(500)
  dailyBatchSize!: number;

  @IsInt()
  @Min(0)
  @Max(1439)
  sendingWindowStartMinutes!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  sendingWindowEndMinutes!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  activeWeekdays!: number[];
}

export class UpdateEmailCampaignDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  goal?: string;

  @IsOptional()
  @IsUUID()
  campaignTypeId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  regionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSequenceStepDto)
  steps?: CreateSequenceStepDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMailboxSenderDto)
  mailboxSenders?: CreateMailboxSenderDto[];

  @IsOptional()
  @IsIn(['contact', 'manual'])
  audienceListType?: 'contact' | 'manual';

  @IsOptional()
  @IsUUID()
  audienceListId?: string;

  @IsOptional()
  @IsObject()
  customFieldValues?: Record<string, string>;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(4)
  wizardStepIndex?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'launchAt must be a date in YYYY-MM-DD format',
  })
  launchAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  dailyBatchSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  sendingWindowStartMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440)
  sendingWindowEndMinutes?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  activeWeekdays?: number[];
}

export class UpdateEmailCampaignStatusDto {
  @IsIn(['draft', 'scheduled', 'sending', 'sent', 'failed'])
  status!: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
}

export class AddEmailCampaignRecipientDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;
}

export class UpdateEmailCampaignRecipientDto {
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsIn(['interested', 'not_now', 'no', 'ooo', 'wrong_person'])
  replyCategory?:
    'interested' | 'not_now' | 'no' | 'ooo' | 'wrong_person' | null;

  @IsOptional()
  @IsIn(['eligible', 'excluded', 'paused', 'stopped', 'unsubscribed'])
  contactDisposition?:
    'eligible' | 'excluded' | 'paused' | 'stopped' | 'unsubscribed';
}

export class PauseEmailCampaignRecipientDto {
  @IsString()
  pausedUntil!: string;
}

export class PauseEmailCampaignDto {
  @IsString()
  pausedUntil!: string;
}

export class PauseCampaignMailboxSenderDto {
  @IsOptional()
  @IsBoolean()
  pauseCampaign?: boolean;

  @ValidateIf(
    (dto: PauseCampaignMailboxSenderDto) => dto.pauseCampaign === true,
  )
  @IsString()
  pausedUntil?: string;
}

export class StopCampaignMailboxSenderDto {
  @IsOptional()
  @IsBoolean()
  pauseCampaign?: boolean;
}

export class ResumeEmailCampaignDto {
  @IsOptional()
  @IsBoolean()
  resumePausedMailboxSenders?: boolean;
}

export class UpdateCampaignMailboxSenderDto {
  @IsOptional()
  @IsUUID()
  mailboxId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  senderName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(255)
  senderEmail?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  dailySendQuota?: number;
}
