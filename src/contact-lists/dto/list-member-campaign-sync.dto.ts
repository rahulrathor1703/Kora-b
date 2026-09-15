import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class ListCampaignRemovalActionDto {
  @IsUUID()
  campaignId!: string;

  @IsIn(['stop', 'exclude_globally'])
  action!: 'stop' | 'exclude_globally';
}

export class RemoveContactListMemberDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ListCampaignRemovalActionDto)
  campaignActions?: ListCampaignRemovalActionDto[];
}

export class EnrollContactListMembersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  campaignIds!: string[];
}

export class EnrollManualListRowsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  rowIds!: string[];

  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  campaignIds!: string[];
}

export class ContactListEnrollmentOptionsQueryDto {
  @IsOptional()
  @IsString()
  emails?: string;
}

export class ManualListEnrollmentOptionsQueryDto {
  @IsOptional()
  @IsString()
  rowIds?: string;
}
