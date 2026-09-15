import { IsUUID } from 'class-validator';

export class AssignGoogleConnectionDto {
  @IsUUID()
  connectionId!: string;
}
