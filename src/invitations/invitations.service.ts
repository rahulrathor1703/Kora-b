import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.types';
import { MailService } from '../mail/mail.service';
import { RolesRepository } from '../rbac/roles.repository';
import { UserRolesRepository } from '../rbac/user-roles.repository';
import { UserRole } from '../users/entities/user.entity';
import {
  USERS_REPOSITORY,
  type UsersRepositoryPort,
} from '../users/users.repository.port';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationEntity } from './entities/invitation.entity';
import { InvitationsRepository } from './invitations.repository';
import type {
  CreateInvitationResult,
  InvitationSummary,
  InvitationValidation,
} from './invitations.types';

const INVITE_EXPIRY_DAYS = 7;
const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,30}$/;

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitationsRepository: InvitationsRepository,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepositoryPort,
    private readonly rolesRepository: RolesRepository,
    private readonly userRolesRepository: UserRolesRepository,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly orgQuotaService: OrgQuotaService,
  ) {}

  async create(
    dto: CreateInvitationDto,
    invitedBy: AuthUser,
    organizationId: string | null,
  ): Promise<CreateInvitationResult> {
    const resolvedOrganizationId = requireOrganizationId(
      organizationId ?? invitedBy.organizationId,
    );

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'settings.members',
    );

    const email = dto.email.toLowerCase().trim();

    const existingUser = await this.usersRepository.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const pendingInvite =
      await this.invitationsRepository.findPendingByEmailAndOrganizationId(
        email,
        resolvedOrganizationId,
      );
    if (pendingInvite) {
      throw new ConflictException(
        'A pending invitation already exists for this email',
      );
    }

    const role = await this.rolesRepository.findById(dto.roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (role.slug === 'super-admin') {
      throw new ForbiddenException(
        'Cannot invite users to the super admin role',
      );
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const invitation = this.invitationsRepository.create({
      organizationId: resolvedOrganizationId,
      email,
      tokenHash,
      roleId: dto.roleId,
      hierarchyLevel: dto.hierarchyLevel,
      status: 'pending',
      invitedByUserId: invitedBy.id,
      expiresAt,
      acceptedAt: null,
    });

    const saved = await this.invitationsRepository.save(invitation);
    const inviteUrl = `${this.config.get<string>('frontendUrl') ?? 'http://localhost:3007'}/accept-invite?token=${rawToken}`;

    await this.mailService.sendInviteEmail({
      to: email,
      inviteUrl,
      roleName: role.name,
      hierarchyLevel: dto.hierarchyLevel,
      invitedByEmail: invitedBy.email,
    });

    const reloaded = await this.invitationsRepository.findById(saved.id);
    if (!reloaded) {
      throw new NotFoundException('Invitation not found after creation');
    }

    return {
      invitation: this.toSummary(reloaded),
      inviteUrl,
    };
  }

  async findAllPending(
    organizationId: string | null,
  ): Promise<InvitationSummary[]> {
    const invitations =
      await this.invitationsRepository.findAllPendingByOrganizationId(
        requireOrganizationId(organizationId),
      );
    return invitations.map((invitation) => this.toSummary(invitation));
  }

  async revoke(id: string, organizationId: string | null): Promise<void> {
    const invitation =
      await this.invitationsRepository.findByIdAndOrganizationId(
        id,
        requireOrganizationId(organizationId),
      );

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    await this.invitationsRepository.updateStatus(id, 'revoked');
  }

  async validateToken(token: string): Promise<InvitationValidation> {
    const invitation = await this.findValidPendingInvitation(token);

    return {
      email: invitation.email,
      roleName: invitation.role.name,
      hierarchyLevel: invitation.hierarchyLevel,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async accept(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<{ accessToken: string; user: AuthUser }> {
    const invitation = await this.findValidPendingInvitation(token);
    const username = dto.username.trim();

    if (!USERNAME_PATTERN.test(username)) {
      throw new BadRequestException(
        'Username must be 3–30 characters and contain only letters, numbers, underscores, or hyphens',
      );
    }

    const existingUsername =
      await this.usersRepository.findByUsername(username);
    if (existingUsername) {
      throw new ConflictException('Username is already taken');
    }

    const existingEmail = await this.usersRepository.findByEmail(
      invitation.email,
    );
    if (existingEmail) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = this.usersRepository.createEntity({
      email: invitation.email,
      username,
      passwordHash,
      hierarchyLevel: invitation.hierarchyLevel,
      status: 'active',
      onboardingStep: 0,
      role: UserRole.ADMIN,
      organizationId: invitation.organizationId,
    });

    const savedUser = await this.usersRepository.save(user);

    await this.userRolesRepository.replaceRoleForUser(
      savedUser.id,
      invitation.roleId,
    );

    await this.invitationsRepository.updateStatus(
      invitation.id,
      'accepted',
      new Date(),
    );

    const authUser = await this.authService.buildAuthUser(savedUser);
    const { accessToken } = await this.authService.login(authUser);

    return { accessToken, user: authUser };
  }

  private async findValidPendingInvitation(
    token: string,
  ): Promise<InvitationEntity> {
    const tokenHash = hashToken(token);
    const invitation =
      await this.invitationsRepository.findByTokenHash(tokenHash);

    if (!invitation) {
      throw new NotFoundException('Invalid invitation link');
    }

    if (invitation.status === 'revoked') {
      throw new BadRequestException('This invitation has been revoked');
    }

    if (invitation.status === 'accepted') {
      throw new BadRequestException(
        'This invitation has already been accepted',
      );
    }

    if (invitation.status === 'expired' || invitation.expiresAt < new Date()) {
      if (invitation.status === 'pending') {
        await this.invitationsRepository.updateStatus(invitation.id, 'expired');
      }

      throw new BadRequestException('This invitation has expired');
    }

    return invitation;
  }

  private toSummary(invitation: InvitationEntity): InvitationSummary {
    return {
      id: invitation.id,
      email: invitation.email,
      roleId: invitation.roleId,
      roleName: invitation.role?.name ?? 'Unknown',
      hierarchyLevel: invitation.hierarchyLevel,
      status: invitation.status,
      invitedByEmail: invitation.invitedBy?.email ?? 'Unknown',
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
