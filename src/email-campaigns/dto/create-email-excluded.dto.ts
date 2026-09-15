import { IsEmail, IsIn, IsUUID } from 'class-validator';

export const EMAIL_EXCLUDED_LIST_TYPES = ['contact', 'manual'] as const;

export type EmailExcludedListType = (typeof EMAIL_EXCLUDED_LIST_TYPES)[number];

export class CreateEmailExcludedDto {
  @IsEmail()
  email!: string;
}

export class ExcludeFromListDto {
  @IsUUID()
  listId!: string;

  @IsIn(EMAIL_EXCLUDED_LIST_TYPES)
  listType!: EmailExcludedListType;
}
