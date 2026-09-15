import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  MEETING_LIST_STATUSES,
  MEETING_PLATFORMS,
  type MeetingListStatus,
  type MeetingPlatform,
} from '../types/meeting.types';

export class MeetingsQueryDto {
  @IsOptional()
  @IsIn(MEETING_LIST_STATUSES)
  status?: MeetingListStatus;

  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class MeetingsCalendarQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class CreateMeetingDto {
  @IsUUID()
  prospectId!: string;

  @IsIn(MEETING_PLATFORMS)
  platform!: MeetingPlatform;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  agenda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timeZone?: string;
}
