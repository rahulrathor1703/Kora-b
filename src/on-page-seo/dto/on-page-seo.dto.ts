import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateWebsitePropertyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  domain!: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(512)
  sitemapUrl!: string;

  @IsUUID()
  googleConnectionId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxPages?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  ga4Enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ga4PropertyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ga4PropertyName?: string;

  @IsOptional()
  @IsBoolean()
  gscEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  gscSiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  psiEnabled?: boolean;
}

export class UpdateWebsitePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  domain?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(512)
  sitemapUrl?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxPages?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  ga4Enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  ga4PropertyId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ga4PropertyName?: string;

  @IsOptional()
  @IsBoolean()
  gscEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  gscSiteUrl?: string;

  @IsOptional()
  @IsBoolean()
  psiEnabled?: boolean;
}

export class TriggerOnPageAuditDto {
  @IsOptional()
  @IsString()
  propertyId?: string;
}

export class OnPageAuditsQueryDto {
  @IsOptional()
  @IsString()
  websitePropertyId?: string;

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

export class OnPagePageResultsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  hasIssuesOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  thinContentOnly?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;
}
