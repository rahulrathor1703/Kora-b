import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MAILBOX_PROVIDERS = ['gmail', 'outlook', 'smtp'] as const;

export class CreateMailboxDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName!: string;

  @IsEmail()
  email!: string;

  @IsIn(MAILBOX_PROVIDERS)
  provider!: (typeof MAILBOX_PROVIDERS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fromName!: string;

  @IsInt()
  @Min(1)
  @Max(10000)
  dailySendLimit!: number;

  @IsBoolean()
  warmupEnabled!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  appPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  oauthToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpPassword?: string;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;
}

export class UpdateMailboxDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fromName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  dailySendLimit?: number;

  @IsOptional()
  @IsBoolean()
  warmupEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  appPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  oauthToken?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpHost?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpUser?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  smtpPassword?: string;

  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;
}

export class UpdateMailboxStatusDto {
  @IsIn(['active', 'inactive'])
  status!: 'active' | 'inactive';
}

export class TestMailboxSendDto {
  @IsEmail()
  to!: string;
}
