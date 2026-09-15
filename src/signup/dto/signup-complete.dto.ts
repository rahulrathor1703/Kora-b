import { IsString, IsUUID, MinLength } from 'class-validator';

export class SignupCompleteDto {
  @IsUUID()
  signupToken!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(8)
  confirmPassword!: string;
}
