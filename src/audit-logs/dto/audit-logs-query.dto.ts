import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  AUDIT_LOG_ACTIONS,
  AUDIT_LOG_MODULES,
  type AuditLogAction,
  type AuditLogModule,
} from '../audit-log.types';

export class AuditLogsQueryDto {
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
  limit?: number = 50;

  @IsOptional()
  @IsIn(AUDIT_LOG_MODULES)
  module?: AuditLogModule;

  @IsOptional()
  @IsIn(AUDIT_LOG_ACTIONS)
  action?: AuditLogAction;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  httpMethod?: string;

  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
