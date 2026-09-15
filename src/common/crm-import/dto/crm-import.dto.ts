import { IsObject } from 'class-validator';

export class CrmImportDto {
  @IsObject()
  fieldMapping!: Record<string, string>;
}
