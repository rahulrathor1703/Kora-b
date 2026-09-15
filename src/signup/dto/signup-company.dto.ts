import { IsString, IsUUID, Length } from 'class-validator';

export class SignupCompanyDto {
  @IsUUID()
  signupToken!: string;

  @IsString()
  @Length(2, 120)
  companyName!: string;
}
