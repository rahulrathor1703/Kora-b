import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type { ProspectDeleteRequestStatus } from '../entities/prospect-delete-request.entity';

const DELETE_REQUEST_STATUSES: ProspectDeleteRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
];

export class CreateProspectDeleteRequestDto {
  @IsUUID()
  prospectId!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(2000)
  reason!: string;
}

export class ProspectDeleteRequestsQueryDto {
  @IsOptional()
  @IsIn(DELETE_REQUEST_STATUSES)
  status?: ProspectDeleteRequestStatus;

  @IsOptional()
  @IsUUID()
  prospectId?: string;
}

export class RejectProspectDeleteRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewNote?: string;
}
