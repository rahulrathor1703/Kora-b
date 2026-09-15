import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';
import type {
  CreateMailboxDto,
  TestMailboxSendDto,
  UpdateMailboxDto,
} from './dto/mailbox.dto';
import type { MailboxEntity, MailboxStatus } from './entities/mailbox.entity';
import {
  MailboxMapper,
  type MailboxCampaignsResponse,
  type SenderMailboxDetailResponse,
  type SenderMailboxResponse,
} from './mappers/mailbox.mapper';
import { isMailboxLockingCampaignStatus } from '../email-campaigns/campaign-mailbox-lock.util';
import { MailboxSendService } from './mailbox-send.service';
import { MailboxesRepository } from './mailboxes.repository';
import { OAuthSessionStore } from './oauth-session.store';
import { MailboxProviderRegistry } from './providers/mailbox-provider.registry';
import type {
  MailboxCredentials,
  ProviderValidationResult,
} from './providers/mailbox-provider.types';

@Injectable()
export class MailboxesService {
  constructor(
    private readonly mailboxesRepository: MailboxesRepository,
    private readonly providerRegistry: MailboxProviderRegistry,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly mailboxMapper: MailboxMapper,
    private readonly oauthSessionStore: OAuthSessionStore,
    @Inject(forwardRef(() => EmailCampaignsRepository))
    private readonly emailCampaignsRepository: EmailCampaignsRepository,
    private readonly orgQuotaService: OrgQuotaService,
    private readonly mailboxSendService: MailboxSendService,
  ) {}

  async findAll(
    organizationId: string | null,
  ): Promise<SenderMailboxResponse[]> {
    const mailboxes = await this.mailboxesRepository.findAllByOrganizationId(
      requireOrganizationId(organizationId),
    );

    return mailboxes.map((mailbox) => this.mailboxMapper.toResponse(mailbox));
  }

  async findOne(
    id: string,
    organizationId: string | null,
  ): Promise<SenderMailboxDetailResponse> {
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      id,
      requireOrganizationId(organizationId),
    );

    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    return this.mailboxMapper.toDetailResponse(mailbox);
  }

  async sendTestEmail(
    id: string,
    dto: TestMailboxSendDto,
    organizationId: string | null,
  ): Promise<{ success: true; messageId: string | null }> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    const result = await this.mailboxSendService.sendTestEmail({
      mailboxId: id,
      organizationId: resolvedOrganizationId,
      fromName: mailbox.fromName,
      fromEmail: mailbox.email,
      to: dto.to.trim(),
    });

    return { success: true, messageId: result.messageId };
  }

  async findCampaignsForMailbox(
    id: string,
    organizationId: string | null,
  ): Promise<MailboxCampaignsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    const rows = await this.emailCampaignsRepository.findCampaignsByMailboxId(
      resolvedOrganizationId,
      id,
    );

    const campaigns = rows.map((row) => ({
      campaignId: row.campaignId,
      campaignName: row.campaignName,
      campaignStatus: row.campaignStatus,
      sender: {
        id: row.senderId,
        status: row.senderStatus,
        dailySendQuota: row.dailySendQuota,
        sendsTodayCount: row.sendsTodayCount,
        sendsTodayDate: row.sendsTodayDate,
        signature: row.signature,
      },
      isLocking:
        isMailboxLockingCampaignStatus(row.campaignStatus) &&
        row.senderStatus === 'active',
    }));

    const activeUsage =
      await this.emailCampaignsRepository.findActiveMailboxUsage(
        resolvedOrganizationId,
        [id],
      );

    const activeLock =
      activeUsage.length > 0
        ? {
            campaignId: activeUsage[0].campaignId,
            campaignName: activeUsage[0].campaignName,
          }
        : null;

    return { campaigns, activeLock };
  }

  async create(
    dto: CreateMailboxDto,
    organizationId: string | null,
    userId: string,
  ): Promise<SenderMailboxResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'email.mailboxes',
    );

    const normalizedEmail = dto.email.trim().toLowerCase();

    const existing =
      await this.mailboxesRepository.findByEmailAndOrganizationId(
        normalizedEmail,
        resolvedOrganizationId,
      );
    if (existing) {
      throw new ConflictException(
        'A mailbox with this email already exists for your organization',
      );
    }

    const validation = await this.validateProviderInput(
      dto.provider,
      {
        email: normalizedEmail,
        appPassword: this.resolveMailboxPassword(dto),
        oauthToken: dto.oauthToken,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpUser: dto.smtpUser,
        smtpPassword: dto.smtpPassword,
        smtpSecure: dto.smtpSecure,
      },
      resolvedOrganizationId,
      userId,
    );

    const mailbox = this.mailboxesRepository.create({
      organizationId: resolvedOrganizationId,
      displayName: dto.displayName.trim(),
      email: validation.email,
      provider: dto.provider,
      status: 'active',
      fromName: dto.fromName.trim(),
      dailySendLimit: dto.dailySendLimit,
      dailySendsUsed: 0,
      dailySendsDate: null,
      warmupEnabled: dto.warmupEnabled,
      syncStatus: validation.syncStatus,
      lastSyncedAt: new Date(),
      smtpHost: validation.smtpHost ?? null,
      smtpPort: validation.smtpPort ?? null,
      smtpUser: validation.smtpUser ?? null,
      smtpSecure: validation.smtpSecure ?? null,
      credentialsEncrypted: this.credentialsCrypto.encrypt(
        validation.credentials,
      ),
    });

    const saved = await this.mailboxesRepository.save(mailbox);
    return this.mailboxMapper.toResponse(saved);
  }

  async update(
    id: string,
    dto: UpdateMailboxDto,
    organizationId: string | null,
  ): Promise<SenderMailboxResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    if (dto.displayName !== undefined) {
      mailbox.displayName = dto.displayName.trim();
    }

    if (dto.fromName !== undefined) {
      mailbox.fromName = dto.fromName.trim();
    }

    if (dto.dailySendLimit !== undefined) {
      mailbox.dailySendLimit = dto.dailySendLimit;
    }

    if (dto.warmupEnabled !== undefined) {
      mailbox.warmupEnabled = dto.warmupEnabled;
    }

    if (mailbox.provider === 'smtp') {
      await this.applySmtpUpdate(mailbox, dto);
    } else if (mailbox.provider === 'gmail' || mailbox.provider === 'outlook') {
      await this.applyAppPasswordProviderUpdate(
        mailbox as MailboxEntity & { provider: 'gmail' | 'outlook' },
        dto,
      );
    }

    const saved = await this.mailboxesRepository.save(mailbox);
    return this.mailboxMapper.toResponse(saved);
  }

  private async applyAppPasswordProviderUpdate(
    mailbox: MailboxEntity & { provider: 'gmail' | 'outlook' },
    dto: UpdateMailboxDto,
  ): Promise<void> {
    const credentialInput = this.extractCredentialChanges(
      mailbox.provider,
      dto,
    );

    if (!credentialInput) {
      if (dto.email && dto.email.trim().toLowerCase() !== mailbox.email) {
        throw new BadRequestException(
          'Email can only be changed when updating app password credentials',
        );
      }
      return;
    }

    const validation = await this.validateProviderInput(
      mailbox.provider,
      {
        email: dto.email?.trim().toLowerCase() ?? mailbox.email,
        appPassword:
          dto.appPassword?.trim() ||
          this.readStoredPassword(
            mailbox.credentialsEncrypted,
            mailbox.provider,
          ),
        oauthToken: dto.oauthToken?.trim(),
      },
      mailbox.organizationId,
    );

    mailbox.email = validation.email;
    mailbox.syncStatus = validation.syncStatus;
    mailbox.lastSyncedAt = new Date();
    mailbox.smtpHost = validation.smtpHost ?? mailbox.smtpHost;
    mailbox.smtpPort = validation.smtpPort ?? mailbox.smtpPort;
    mailbox.smtpUser = validation.smtpUser ?? mailbox.smtpUser;
    mailbox.smtpSecure = validation.smtpSecure ?? mailbox.smtpSecure;
    mailbox.credentialsEncrypted = this.credentialsCrypto.encrypt(
      validation.credentials,
    );
  }

  private async applySmtpUpdate(
    mailbox: MailboxEntity,
    dto: UpdateMailboxDto,
  ): Promise<void> {
    if (dto.smtpHost !== undefined) {
      mailbox.smtpHost = dto.smtpHost.trim();
    }
    if (dto.smtpPort !== undefined) {
      mailbox.smtpPort = dto.smtpPort;
    }
    if (dto.smtpUser !== undefined) {
      mailbox.smtpUser = dto.smtpUser.trim();
    }
    if (dto.smtpSecure !== undefined) {
      mailbox.smtpSecure = dto.smtpSecure;
    }

    const credentialInput = this.extractCredentialChanges('smtp', dto);
    const connectionChanged =
      dto.smtpHost !== undefined ||
      dto.smtpPort !== undefined ||
      dto.smtpUser !== undefined ||
      dto.smtpSecure !== undefined;

    if (!credentialInput && !connectionChanged) {
      if (dto.email && dto.email.trim().toLowerCase() !== mailbox.email) {
        throw new BadRequestException(
          'Email can only be changed when updating SMTP credentials',
        );
      }
      return;
    }

    const smtpValidation = await this.providerRegistry.validate({
      provider: 'smtp',
      email: dto.email?.trim().toLowerCase() ?? mailbox.email,
      smtpHost: mailbox.smtpHost ?? undefined,
      smtpPort: mailbox.smtpPort ?? undefined,
      smtpUser: mailbox.smtpUser ?? undefined,
      smtpPassword:
        dto.smtpPassword?.trim() ??
        this.readStoredPassword(mailbox.credentialsEncrypted, 'smtp'),
      smtpSecure: mailbox.smtpSecure ?? false,
    });

    mailbox.email = smtpValidation.email;
    mailbox.syncStatus = smtpValidation.syncStatus;
    mailbox.lastSyncedAt = new Date();
    mailbox.smtpHost = smtpValidation.smtpHost ?? mailbox.smtpHost;
    mailbox.smtpPort = smtpValidation.smtpPort ?? mailbox.smtpPort;
    mailbox.smtpUser = smtpValidation.smtpUser ?? mailbox.smtpUser;
    mailbox.smtpSecure = smtpValidation.smtpSecure ?? mailbox.smtpSecure;
    mailbox.credentialsEncrypted = this.credentialsCrypto.encrypt(
      smtpValidation.credentials,
    );
  }

  async updateStatus(
    id: string,
    status: MailboxStatus,
    organizationId: string | null,
  ): Promise<SenderMailboxResponse> {
    const updated = await this.mailboxesRepository.updateStatus(
      id,
      requireOrganizationId(organizationId),
      status,
    );

    if (!updated) {
      throw new NotFoundException('Mailbox not found');
    }

    return this.mailboxMapper.toResponse(updated);
  }

  async remove(id: string, organizationId: string | null): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const mailbox = await this.mailboxesRepository.findByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!mailbox) {
      throw new NotFoundException('Mailbox not found');
    }

    const campaignReferences =
      await this.emailCampaignsRepository.countByMailboxId(id);

    if (campaignReferences > 0) {
      throw new ConflictException(
        'This mailbox is assigned to one or more email campaigns. Remove it from those campaigns before deleting.',
      );
    }

    const deleted = await this.mailboxesRepository.deleteByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!deleted) {
      throw new NotFoundException('Mailbox not found');
    }
  }

  private async validateProviderInput(
    provider: CreateMailboxDto['provider'],
    input: {
      email?: string;
      appPassword?: string;
      oauthToken?: string;
      smtpHost?: string;
      smtpPort?: number;
      smtpUser?: string;
      smtpPassword?: string;
      smtpSecure?: boolean;
    },
    organizationId?: string,
    userId?: string,
  ): Promise<ProviderValidationResult> {
    if (provider === 'gmail' || provider === 'outlook') {
      const oauthToken = input.oauthToken?.trim();
      if (oauthToken) {
        if (!organizationId || !userId) {
          throw new BadRequestException(
            'OAuth session requires an authenticated user',
          );
        }

        const session = this.oauthSessionStore.consume(oauthToken);
        if (!session) {
          throw new BadRequestException(
            'Google sign-in expired. Please connect again.',
          );
        }

        if (session.organizationId !== organizationId) {
          throw new ForbiddenException(
            'OAuth session belongs to another organization',
          );
        }

        if (session.userId !== userId) {
          throw new ForbiddenException('OAuth session belongs to another user');
        }

        if (session.provider !== provider) {
          throw new BadRequestException('OAuth provider mismatch');
        }

        return {
          email: session.email,
          syncStatus: 'connected',
          credentials: session.credentials,
          smtpHost:
            provider === 'gmail'
              ? 'smtp.gmail.com'
              : session.email.endsWith('@outlook.com') ||
                  session.email.endsWith('@hotmail.com') ||
                  session.email.endsWith('@live.com')
                ? 'smtp-mail.outlook.com'
                : 'smtp.office365.com',
          smtpPort: 587,
          smtpUser: session.email,
          smtpSecure: false,
        };
      }
    }

    return this.providerRegistry.validate({
      provider,
      email: input.email,
      appPassword: input.appPassword,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpUser: input.smtpUser,
      smtpPassword: input.smtpPassword,
      smtpSecure: input.smtpSecure,
    });
  }

  private resolveMailboxPassword(
    dto: Pick<CreateMailboxDto, 'appPassword'>,
  ): string | undefined {
    return dto.appPassword?.trim() || undefined;
  }

  private extractCredentialChanges(
    provider: MailboxEntity['provider'],
    dto: UpdateMailboxDto,
  ): {
    appPassword?: string;
    oauthToken?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    smtpSecure?: boolean;
  } | null {
    switch (provider) {
      case 'gmail':
      case 'outlook':
        return dto.appPassword?.trim() || dto.oauthToken?.trim()
          ? {
              appPassword: dto.appPassword?.trim(),
              oauthToken: dto.oauthToken?.trim(),
            }
          : null;
      case 'smtp':
        if (
          dto.smtpPassword?.trim() ||
          dto.smtpHost?.trim() ||
          dto.smtpPort !== undefined ||
          dto.smtpUser?.trim() ||
          dto.smtpSecure !== undefined
        ) {
          return {
            smtpHost: dto.smtpHost,
            smtpPort: dto.smtpPort,
            smtpUser: dto.smtpUser,
            smtpPassword: dto.smtpPassword,
            smtpSecure: dto.smtpSecure,
          };
        }
        return null;
      default:
        return null;
    }
  }

  private readStoredPassword(
    credentialsEncrypted: string,
    expectedType: 'gmail' | 'outlook' | 'smtp',
  ): string {
    const credentials =
      this.credentialsCrypto.decrypt<MailboxCredentials>(credentialsEncrypted);

    if (credentials.type !== expectedType) {
      throw new BadRequestException(
        `Invalid ${expectedType} credentials — reconnect with an app password`,
      );
    }

    if (
      (credentials.type === 'gmail' || credentials.type === 'outlook') &&
      credentials.authMethod === 'oauth'
    ) {
      throw new BadRequestException(
        'This mailbox uses Google/Microsoft sign-in — reconnect with the sign-in button',
      );
    }

    if (!credentials.password) {
      throw new BadRequestException(
        'Legacy credentials detected — reconnect with an app password',
      );
    }

    return credentials.password;
  }
}
