import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { setAccessTokenCookie } from '../auth-oauth/auth-oauth-cookie.util';
import { SignupCheckSlugDto } from './dto/signup-check-slug.dto';
import { SignupCompanyDto } from './dto/signup-company.dto';
import { SignupCompleteDto } from './dto/signup-complete.dto';
import { SignupResendOtpDto } from './dto/signup-resend-otp.dto';
import { SignupStartDto } from './dto/signup-start.dto';
import { SignupVerifyOtpDto } from './dto/signup-verify-otp.dto';
import { SignupService } from './signup.service';
import { SignupOAuthCompleteDto } from '../auth-oauth/dto/auth-oauth.dto';

@Controller('auth/signup')
export class SignupController {
  constructor(
    private readonly signupService: SignupService,
    private readonly config: ConfigService,
  ) {}

  @Post('start')
  @HttpCode(200)
  start(@Body() dto: SignupStartDto) {
    return this.signupService.start(dto.email);
  }

  @Post('check-slug')
  @HttpCode(200)
  checkSlug(@Body() dto: SignupCheckSlugDto) {
    return this.signupService.checkSlugAvailability(dto.slug);
  }

  @Post('company')
  @HttpCode(200)
  company(@Body() dto: SignupCompanyDto) {
    return this.signupService.setCompany(dto.signupToken, dto.companyName);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() dto: SignupVerifyOtpDto) {
    return this.signupService.verifyOtp(dto.signupToken, dto.code);
  }

  @Post('resend-otp')
  @HttpCode(200)
  resendOtp(@Body() dto: SignupResendOtpDto) {
    return this.signupService.resendOtp(dto.signupToken);
  }

  @Post('complete')
  @HttpCode(200)
  async complete(
    @Body() dto: SignupCompleteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.signupService.complete(
      dto.signupToken,
      dto.password,
      dto.confirmPassword,
    );

    setAccessTokenCookie(res, result.accessToken, this.config);

    return {
      message: 'Account created',
      user: result.user,
      organization: result.organization,
    };
  }

  @Post('oauth/complete')
  @HttpCode(200)
  async completeOAuth(
    @Body() dto: SignupOAuthCompleteDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.signupService.completeOAuth(
      dto.oauthSignupToken,
      dto.companyName,
    );

    setAccessTokenCookie(res, result.accessToken, this.config);

    return {
      message: 'Account created',
      user: result.user,
      organization: result.organization,
    };
  }
}
