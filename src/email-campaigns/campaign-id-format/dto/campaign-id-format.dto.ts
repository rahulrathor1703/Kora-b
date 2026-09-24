import { IsString, MaxLength, MinLength } from 'class-validator';

export class SetCampaignIdFormatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  format!: string;
}

export interface CampaignIdFormatResponse {
  format: string | null;
  configured: boolean;
  locked: boolean;
  updatedAt: string | null;
}
