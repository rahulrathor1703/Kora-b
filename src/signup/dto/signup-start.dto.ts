import { IsEmail } from 'class-validator';

export class SignupStartDto {
  @IsEmail()
  email!: string;
}
