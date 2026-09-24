import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SignupModule } from '../signup/signup.module';
import { UsersModule } from '../users/users.module';
import {
  AuthOAuthController,
  PlatformAuthOAuthController,
} from './auth-oauth.controller';
import { AuthOAuthFlowService } from './auth-oauth-flow.service';
import { PlatformAuthOAuthProviderEntity } from './entities/platform-auth-oauth-provider.entity';
import { OAuthAuthService } from './oauth-auth.service';
import { PlatformAuthOAuthRepository } from './platform-auth-oauth.repository';
import { PLATFORM_AUTH_OAUTH_REPOSITORY } from './platform-auth-oauth.repository.port';
import { PlatformAuthOAuthService } from './platform-auth-oauth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformAuthOAuthProviderEntity]),
    AuthModule,
    SignupModule,
    UsersModule,
  ],
  controllers: [AuthOAuthController, PlatformAuthOAuthController],
  providers: [
    PlatformAuthOAuthService,
    OAuthAuthService,
    AuthOAuthFlowService,
    {
      provide: PLATFORM_AUTH_OAUTH_REPOSITORY,
      useClass: PlatformAuthOAuthRepository,
    },
  ],
  exports: [PlatformAuthOAuthService],
})
export class AuthOAuthModule {}
