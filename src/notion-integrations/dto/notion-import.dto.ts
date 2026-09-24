import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const NOTION_IMPORT_DESTINATIONS = [
  'company',
  'prospect',
  'contact-list',
] as const;

export type NotionImportDestinationDto =
  (typeof NOTION_IMPORT_DESTINATIONS)[number];

export class NotionImportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  databaseId!: string;

  @IsIn(NOTION_IMPORT_DESTINATIONS)
  destination!: NotionImportDestinationDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  excludedPropertyIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contactListName?: string;
}

export class NotionColumnsQueryDto {
  @IsIn(NOTION_IMPORT_DESTINATIONS)
  destination!: NotionImportDestinationDto;
}
