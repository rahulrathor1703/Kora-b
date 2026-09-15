import { IsArray, IsInt, IsObject, IsOptional } from 'class-validator';
import type {
  FormFieldDefinition,
  FormLayoutConfig,
  FormTableColumnDefinition,
  FormWizardStepDefinition,
} from '../types/form-schema.types';

export class UpdateFormSchemaDto {
  @IsArray()
  fields!: FormFieldDefinition[];

  @IsOptional()
  @IsArray()
  tableColumns?: FormTableColumnDefinition[];

  @IsOptional()
  @IsArray()
  steps?: FormWizardStepDefinition[] | null;

  @IsOptional()
  @IsObject()
  layout?: FormLayoutConfig | null;

  @IsOptional()
  @IsInt()
  version?: number;
}
