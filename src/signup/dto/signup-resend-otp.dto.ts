import { IsUUID } from 'class-validator';

export class SignupResendOtpDto {
  @IsUUID()
  signupToken!: string;
}
