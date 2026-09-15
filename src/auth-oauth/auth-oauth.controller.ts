import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { AuthOAuthFlowService } from './auth-oauth-flow.service';
import {
  OAuthIdTokenDto,
  UpdatePlatformAuthOAuthProviderDto,
} from './dto/auth-oauth.dto';
import { PlatformAuthOAuthService } from './platform-auth-oauth.service';
import { setAccessTokenCookie } from './auth-oauth-cookie.util';

@Controller('auth/oauth')
export class AuthOAuthController {
  constructor(
    private readonly platformAuthOAuthService: PlatformAuthOAuthService,
    private readonly authOAuthFlowService: AuthOAuthFlowService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get('config')
  getConfig() {
    return this.platformAuthOAuthService.getPublicConfig();
  }

  @Post('google')
  @HttpCode(200)
  async loginWithGoogle(
    @Body() dto: OAuthIdTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authOAuthFlowService.authenticateGoogle(
      dto.idToken,
    );

    if (result.kind === 'signup') {
      return {
        needsSignup: true,
        oauthSignupToken: result.oauthSignupToken,
        email: result.email,
      };
    }

    setAccessTokenCookie(res, result.accessToken, this.config);

    return {
      message: 'Logged in',
      user: await this.authService.getUserProfile(result.user.id),
    };
  }

  @Post('apple')
  @HttpCode(200)
  async loginWithApple(
    @Body() dto: OAuthIdTokenDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authOAuthFlowService.authenticateApple(
      dto.idToken,
    );

    if (result.kind === 'signup') {
      return {
        needsSignup: true,
        oauthSignupToken: result.oauthSignupToken,
        email: result.email,
      };
    }

    setAccessTokenCookie(res, result.accessToken, this.config);

    return {
      message: 'Logged in',
      user: await this.authService.getUserProfile(result.user.id),
    };
  }
}

@Controller('platform/auth-oauth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPERADMIN)
export class PlatformAuthOAuthController {
  constructor(
    private readonly platformAuthOAuthService: PlatformAuthOAuthService,
  ) {}

  @Get()
  listProviders() {
    return this.platformAuthOAuthService.listProviders();
  }

  @Put(':provider')
  updateProvider(
    @Param('provider') provider: 'google' | 'apple',
    @Body() dto: UpdatePlatformAuthOAuthProviderDto,
  ) {
    return this.platformAuthOAuthService.updateProvider(provider, dto);
  }
}
