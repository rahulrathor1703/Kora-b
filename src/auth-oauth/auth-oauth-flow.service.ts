import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService, type AuthUserProfile } from '../auth/auth.service';
import {
  OAuthAuthService,
  type VerifiedOAuthProfile,
} from './oauth-auth.service';
import { SignupService } from '../signup/signup.service';
import { UsersService } from '../users/users.service';
import type { User } from '../users/entities/user.entity';

export type OAuthAuthenticateResult =
  | {
      kind: 'login';
      user: AuthUserProfile;
      accessToken: string;
    }
  | {
      kind: 'signup';
      oauthSignupToken: string;
      email: string;
    };

@Injectable()
export class AuthOAuthFlowService {
  constructor(
    private readonly oauthAuthService: OAuthAuthService,
    private readonly usersService: UsersService,
    private readonly signupService: SignupService,
    private readonly authService: AuthService,
  ) {}

  authenticateGoogle(idToken: string): Promise<OAuthAuthenticateResult> {
    return this.authenticateProvider(() =>
      this.oauthAuthService.verifyGoogleIdToken(idToken),
    );
  }

  authenticateApple(idToken: string): Promise<OAuthAuthenticateResult> {
    return this.authenticateProvider(() =>
      this.oauthAuthService.verifyAppleIdToken(idToken),
    );
  }

  private async authenticateProvider(
    verify: () => Promise<VerifiedOAuthProfile>,
  ): Promise<OAuthAuthenticateResult> {
    const profile = await verify();
    const existingByProvider = await this.findUserByProvider(profile);

    if (existingByProvider) {
      return this.loginExistingUser(existingByProvider);
    }

    const existingByEmail = await this.usersService.findByEmail(profile.email);

    if (existingByEmail) {
      if (existingByEmail.status === 'disabled') {
        throw new UnauthorizedException('User account is disabled');
      }

      this.applyProviderIdentity(existingByEmail, profile);
      const saved = await this.usersService.save(existingByEmail);
      return this.loginExistingUser(saved);
    }

    const { oauthSignupToken } = await this.signupService.startFromOAuth(
      profile.provider,
      profile.email,
      profile.subjectId,
    );

    return {
      kind: 'signup',
      oauthSignupToken,
      email: profile.email,
    };
  }

  private async loginExistingUser(
    user: User,
  ): Promise<Extract<OAuthAuthenticateResult, { kind: 'login' }>> {
    if (user.status === 'disabled') {
      throw new UnauthorizedException('User account is disabled');
    }

    const authUser = await this.authService.buildAuthUser(user);
    const { accessToken } = await this.authService.login(authUser);

    return {
      kind: 'login',
      user: authUser,
      accessToken,
    };
  }

  private findUserByProvider(
    profile: VerifiedOAuthProfile,
  ): Promise<User | null> {
    if (profile.provider === 'google') {
      return this.usersService.findByGoogleId(profile.subjectId);
    }

    return this.usersService.findByAppleId(profile.subjectId);
  }

  private applyProviderIdentity(
    user: User,
    profile: VerifiedOAuthProfile,
  ): void {
    if (profile.provider === 'google') {
      user.googleId = profile.subjectId;
      return;
    }

    user.appleId = profile.subjectId;
  }
}
