import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConnectNotionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  integrationToken!: string;
}
