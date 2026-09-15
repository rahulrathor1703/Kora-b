import { IsObject } from 'class-validator';

export class ManualListRowDto {
  @IsObject()
  values!: Record<string, string>;
}
