import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ManualListColumnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  label!: string;
}
