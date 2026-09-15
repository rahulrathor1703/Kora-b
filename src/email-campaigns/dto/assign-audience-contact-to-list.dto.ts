import { IsEmail, IsIn, IsString, IsUUID, MaxLength } from 'class-validator';
import type { EmailExcludedListType } from './create-email-excluded.dto';

export class AssignAudienceContactToListDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsUUID()
  listId!: string;

  @IsString()
  @IsIn(['contact', 'manual'])
  listType!: EmailExcludedListType;
}
