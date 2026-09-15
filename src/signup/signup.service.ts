import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { RolesRepository } from '../rbac/roles.repository';
import { UserRolesRepository } from '../rbac/user-roles.repository';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import type { SignupSession } from './entities/signup-session.entity';
import {
  SIGNUP_REPOSITORY,
  type SignupRepositoryPort,
} from './signup.repository.port';

const SESSION_TTL_MS = 30 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export interface SignupCompleteResult {
  user: { id: string; email: string; role: UserRole };
  organization: { id: string; name: string; slug: string };
  accessToken: string;
}

@Injectable()
export class SignupService {
  constructor(
    @Inject(SIGNUP_REPOSITORY)
    private readonly signupRepository: SignupRepositoryPort,
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly rolesRepository: RolesRepository,
    private readonly userRolesRepository: UserRolesRepository,
  ) {}

  async start(email: string): Promise<{ signupToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.signupRepository.create(normalizedEmail, token, expiresAt);

    return { signupToken: token };
  }

  async setCompany(
    signupToken: string,
    companyName: string,
  ): Promise<{ message: string; email: string }> {
    const session = await this.getActiveSession(signupToken);

    session.companyName = companyName.trim();
    await this.issueOtp(session);

    return {
      message: 'Verification code sent',
      email: session.email,
    };
  }

  async verifyOtp(
    signupToken: string,
    code: string,
  ): Promise<{ message: string }> {
    const session = await this.getActiveSession(signupToken);

    if (!session.companyName) {
      throw new BadRequestException(
        'Company name is required before verification',
      );
    }

    if (!session.otpHash || !session.otpExpiresAt) {
      throw new BadRequestException('Verification code has not been sent');
    }

    if (session.emailVerifiedAt) {
      return { message: 'Email already verified' };
    }

    if (session.otpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Verification code has expired');
    }

    if (session.otpAttempts >= MAX_OTP_ATTEMPTS) {
      throw new UnauthorizedException(
        'Too many failed attempts. Start sign-up again.',
      );
    }

    const matches = await bcrypt.compare(code, session.otpHash);

    if (!matches) {
      session.otpAttempts += 1;
      await this.signupRepository.save(session);
      throw new UnauthorizedException('Invalid verification code');
    }

    session.emailVerifiedAt = new Date();
    session.otpHash = null;
    session.otpExpiresAt = null;
    await this.signupRepository.save(session);

    return { message: 'Email verified' };
  }

  async resendOtp(
    signupToken: string,
  ): Promise<{ message: string; email: string }> {
    const session = await this.getActiveSession(signupToken);

    if (!session.companyName) {
      throw new BadRequestException(
        'Company name is required before resending code',
      );
    }

    if (session.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }

    if (
      session.lastOtpSentAt &&
      Date.now() - session.lastOtpSentAt.getTime() < RESEND_COOLDOWN_MS
    ) {
      throw new BadRequestException(
        'Please wait before requesting another verification code',
      );
    }

    await this.issueOtp(session);

    return {
      message: 'Verification code resent',
      email: session.email,
    };
  }

  async checkSlugAvailability(slug: string): Promise<{ available: boolean }> {
    return {
      available: await this.organizationsService.isSlugAvailable(slug),
    };
  }

  async complete(
    signupToken: string,
    password: string,
    confirmPassword: string,
  ): Promise<SignupCompleteResult> {
    if (password !== confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const session = await this.getActiveSession(signupToken);

    if (!session.companyName) {
      throw new BadRequestException('Company name is required');
    }

    if (!session.emailVerifiedAt) {
      throw new BadRequestException(
        'Email must be verified before completing sign-up',
      );
    }

    const existing = await this.usersService.findByEmail(session.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const organization = await this.organizationsService.create(
      session.companyName,
    );
    const passwordHash = await this.authService.hashPassword(password);
    const user = await this.usersService.create(
      session.email,
      passwordHash,
      UserRole.ADMIN,
      organization.id,
    );

    const adminRole = await this.rolesRepository.findBySlug('admin');
    if (adminRole) {
      await this.userRolesRepository.replaceRoleForUser(user.id, adminRole.id);
    }

    await this.signupRepository.deleteById(session.id);

    const authUser = await this.authService.buildAuthUser(
      (await this.usersService.findById(user.id))!,
    );
    const { accessToken } = await this.authService.login(authUser);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      accessToken,
    };
  }

  async startFromOAuth(
    provider: 'google' | 'apple',
    email: string,
    subjectId: string,
  ): Promise<{ oauthSignupToken: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(normalizedEmail);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await this.signupRepository.createOAuthSession({
      email: normalizedEmail,
      token,
      expiresAt,
      oauthProvider: provider,
      oauthSubjectId: subjectId,
    });

    return { oauthSignupToken: token };
  }

  async completeOAuth(
    oauthSignupToken: string,
    companyName: string,
  ): Promise<SignupCompleteResult> {
    const session = await this.getActiveSession(oauthSignupToken);

    if (!session.oauthProvider || !session.oauthSubjectId) {
      throw new BadRequestException('Invalid OAuth sign-up session');
    }

    if (!session.emailVerifiedAt) {
      throw new BadRequestException('OAuth email must be verified');
    }

    const existing = await this.usersService.findByEmail(session.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const organization = await this.organizationsService.create(
      companyName.trim(),
    );

    const userEntity = this.usersService.createEntity({
      email: session.email,
      passwordHash: null,
      authProvider: session.oauthProvider,
      googleId:
        session.oauthProvider === 'google' ? session.oauthSubjectId : null,
      appleId:
        session.oauthProvider === 'apple' ? session.oauthSubjectId : null,
      role: UserRole.ADMIN,
      organizationId: organization.id,
    });
    const user = await this.usersService.save(userEntity);

    const adminRole = await this.rolesRepository.findBySlug('admin');
    if (adminRole) {
      await this.userRolesRepository.replaceRoleForUser(user.id, adminRole.id);
    }

    await this.signupRepository.deleteById(session.id);

    const authUser = await this.authService.buildAuthUser(
      (await this.usersService.findById(user.id))!,
    );
    const { accessToken } = await this.authService.login(authUser);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
      accessToken,
    };
  }

  private async getActiveSession(token: string): Promise<SignupSession> {
    const session = await this.signupRepository.findByToken(token);

    if (!session) {
      throw new BadRequestException('Invalid or expired sign-up session');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Sign-up session has expired');
    }

    return session;
  }

  private async issueOtp(session: SignupSession): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const otpHash = await bcrypt.hash(code, 10);

    session.otpHash = otpHash;
    session.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    session.otpAttempts = 0;
    session.lastOtpSentAt = new Date();

    await this.signupRepository.save(session);
    await this.mailService.sendOtpEmail(session.email, code);
  }
}
