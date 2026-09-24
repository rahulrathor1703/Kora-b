import { ConflictException, NotFoundException } from '@nestjs/common';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { EmailCampaignsRepository } from '../email-campaigns/email-campaigns.repository';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import type { MailboxEntity } from './entities/mailbox.entity';
import { MailboxMapper } from './mappers/mailbox.mapper';
import { MailboxesRepository } from './mailboxes.repository';
import { MailboxesService } from './mailboxes.service';
import { OAuthSessionStore } from './oauth-session.store';
import { MailboxProviderRegistry } from './providers/mailbox-provider.registry';

describe('MailboxesService', () => {
  const organizationId = 'org-1';
  const userId = 'user-1';

  let service: MailboxesService;
  let repository: jest.Mocked<MailboxesRepository>;
  let providerRegistry: jest.Mocked<MailboxProviderRegistry>;
  let credentialsCrypto: jest.Mocked<CredentialsCryptoService>;
  let mailboxMapper: jest.Mocked<MailboxMapper>;
  let oauthSessionStore: jest.Mocked<OAuthSessionStore>;
  let emailCampaignsRepository: jest.Mocked<EmailCampaignsRepository>;
  let orgQuotaService: jest.Mocked<OrgQuotaService>;

  beforeEach(() => {
    repository = {
      findAllByOrganizationId: jest.fn(),
      findByIdAndOrganizationId: jest.fn(),
      findByEmailAndOrganizationId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      updateStatus: jest.fn(),
      deleteByIdAndOrganizationId: jest.fn(),
    } as unknown as jest.Mocked<MailboxesRepository>;

    providerRegistry = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<MailboxProviderRegistry>;

    credentialsCrypto = {
      encrypt: jest.fn().mockReturnValue('encrypted'),
      decrypt: jest.fn(),
      maskSecret: jest.fn(),
    } as unknown as jest.Mocked<CredentialsCryptoService>;

    mailboxMapper = {
      toResponse: jest.fn(),
      toDetailResponse: jest.fn(),
    } as unknown as jest.Mocked<MailboxMapper>;

    oauthSessionStore = {
      create: jest.fn(),
      consume: jest.fn(),
    } as unknown as jest.Mocked<OAuthSessionStore>;

    emailCampaignsRepository = {
      countByMailboxId: jest.fn(),
      findCampaignsByMailboxId: jest.fn(),
      findActiveMailboxUsage: jest.fn(),
    } as unknown as jest.Mocked<EmailCampaignsRepository>;

    orgQuotaService = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrgQuotaService>;

    service = new MailboxesService(
      repository,
      providerRegistry,
      credentialsCrypto,
      mailboxMapper,
      oauthSessionStore,
      emailCampaignsRepository,
      orgQuotaService,
    );
  });

  it('creates a Gmail mailbox with app password and SMTP preset fields', async () => {
    repository.findByEmailAndOrganizationId.mockResolvedValue(null);
    providerRegistry.validate.mockResolvedValue({
      email: 'sales@gmail.com',
      syncStatus: 'connected',
      credentials: {
        type: 'gmail',
        password: 'app-password',
        authMethod: 'smtp',
      },
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'sales@gmail.com',
      smtpSecure: false,
    });

    const createdEntity = {
      id: 'mailbox-2',
      organizationId,
      displayName: 'Gmail Sales',
      email: 'sales@gmail.com',
      provider: 'gmail',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      syncStatus: 'connected',
      lastSyncedAt: new Date(),
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'sales@gmail.com',
      smtpSecure: false,
      credentialsEncrypted: 'encrypted',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as MailboxEntity;

    repository.create.mockReturnValue(createdEntity);
    repository.save.mockResolvedValue(createdEntity);
    mailboxMapper.toResponse.mockReturnValue({
      id: 'mailbox-2',
      displayName: 'Gmail Sales',
      email: 'sales@gmail.com',
      provider: 'gmail',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      config: {
        syncStatus: 'connected',
        lastSyncedAt: createdEntity.lastSyncedAt.toISOString(),
        providerLabel: 'Connected with app password',
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'sales@gmail.com',
        smtpSecure: false,
      },
    });

    await service.create(
      {
        displayName: 'Gmail Sales',
        email: 'sales@gmail.com',
        provider: 'gmail',
        fromName: 'Sales Team',
        dailySendLimit: 100,
        warmupEnabled: false,
        appPassword: 'app-password',
      },
      organizationId,
      userId,
    );

    expect(providerRegistry.validate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        provider: 'gmail',
        email: 'sales@gmail.com',
        appPassword: 'app-password',
      }),
    );
    expect(repository.create.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        smtpHost: 'smtp.gmail.com',
        smtpPort: 587,
        smtpUser: 'sales@gmail.com',
        smtpSecure: false,
      }),
    );
  });

  it('updates Gmail mailbox when a new app password is provided', async () => {
    const mailbox = {
      id: 'mailbox-2',
      organizationId,
      displayName: 'Gmail Sales',
      email: 'sales@gmail.com',
      provider: 'gmail',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      syncStatus: 'connected',
      lastSyncedAt: new Date(),
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'sales@gmail.com',
      smtpSecure: false,
      credentialsEncrypted: 'encrypted',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as MailboxEntity;

    repository.findByIdAndOrganizationId.mockResolvedValue(mailbox);
    providerRegistry.validate.mockResolvedValue({
      email: 'sales@gmail.com',
      syncStatus: 'connected',
      credentials: { type: 'gmail', password: 'new-app-password' },
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      smtpUser: 'sales@gmail.com',
      smtpSecure: false,
    });
    repository.save.mockResolvedValue(mailbox);
    mailboxMapper.toResponse.mockReturnValue({
      id: 'mailbox-2',
      displayName: 'Gmail Sales',
      email: 'sales@gmail.com',
      provider: 'gmail',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      config: {
        syncStatus: 'connected',
        lastSyncedAt: mailbox.lastSyncedAt.toISOString(),
        providerLabel: 'Connected with app password',
      },
    });

    await service.update(
      'mailbox-2',
      {
        appPassword: 'new-app-password',
      },
      organizationId,
      userId,
    );

    expect(providerRegistry.validate.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        provider: 'gmail',
        appPassword: 'new-app-password',
      }),
    );
  });

  it('rejects duplicate mailbox emails within the same organization', async () => {
    repository.findByEmailAndOrganizationId.mockResolvedValue({
      id: 'existing',
    } as MailboxEntity);

    await expect(
      service.create(
        {
          displayName: 'Sales',
          email: 'sales@example.com',
          provider: 'gmail',
          fromName: 'Sales Team',
          dailySendLimit: 100,
          warmupEnabled: false,
          appPassword: 'app-password',
        },
        organizationId,
        userId,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates mailbox status within the organization scope', async () => {
    const mailbox = {
      id: 'mailbox-1',
      organizationId,
      status: 'inactive',
    } as MailboxEntity;

    repository.updateStatus.mockResolvedValue(mailbox);
    mailboxMapper.toResponse.mockReturnValue({
      id: 'mailbox-1',
      displayName: 'Sales',
      email: 'sales@example.com',
      provider: 'gmail',
      status: 'inactive',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      config: {
        syncStatus: 'connected',
        lastSyncedAt: null,
      },
    });

    const result = await service.updateStatus(
      'mailbox-1',
      'inactive',
      organizationId,
      userId,
    );

    expect(result.status).toBe('inactive');
  });

  it('returns not found when updating a missing mailbox', async () => {
    repository.updateStatus.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', 'inactive', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns a mailbox detail response when found', async () => {
    const mailbox = {
      id: 'mailbox-1',
      organizationId,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    } as MailboxEntity;

    repository.findByIdAndOrganizationId.mockResolvedValue(mailbox);
    mailboxMapper.toDetailResponse.mockReturnValue({
      id: 'mailbox-1',
      displayName: 'Sales',
      email: 'sales@example.com',
      provider: 'gmail',
      status: 'active',
      fromName: 'Sales Team',
      dailySendLimit: 100,
      dailySendsUsed: 0,
      warmupEnabled: false,
      config: { syncStatus: 'connected', lastSyncedAt: null },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    const result = await service.findOne('mailbox-1', organizationId);

    expect(result.id).toBe('mailbox-1');
    expect(result.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(mailboxMapper.toDetailResponse.mock.calls).toEqual([[mailbox]]);
  });

  it('returns not found when fetching a missing mailbox', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(
      service.findOne('missing', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns campaigns for a mailbox with lock info', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue({
      id: 'mailbox-1',
      organizationId,
    } as MailboxEntity);
    emailCampaignsRepository.findCampaignsByMailboxId.mockResolvedValue([
      {
        campaignId: 'campaign-1',
        campaignName: 'Outbound Q1',
        campaignStatus: 'sending',
        senderId: 'sender-1',
        senderStatus: 'active',
        dailySendQuota: 50,
        sendsTodayCount: 12,
        sendsTodayDate: '2026-01-15',
        signature: 'Best regards',
      },
      {
        campaignId: 'campaign-2',
        campaignName: 'Draft campaign',
        campaignStatus: 'draft',
        senderId: 'sender-2',
        senderStatus: 'active',
        dailySendQuota: null,
        sendsTodayCount: 0,
        sendsTodayDate: null,
        signature: null,
      },
    ]);
    emailCampaignsRepository.findActiveMailboxUsage.mockResolvedValue([
      {
        mailboxId: 'mailbox-1',
        campaignId: 'campaign-1',
        campaignName: 'Outbound Q1',
      },
    ]);

    const result = await service.findCampaignsForMailbox(
      'mailbox-1',
      organizationId,
    );

    expect(result.campaigns).toHaveLength(2);
    expect(result.campaigns[0].isLocking).toBe(true);
    expect(result.campaigns[1].isLocking).toBe(false);
    expect(result.activeLock).toEqual({
      campaignId: 'campaign-1',
      campaignName: 'Outbound Q1',
    });
  });

  it('returns empty campaigns when mailbox has no assignments', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue({
      id: 'mailbox-1',
      organizationId,
    } as MailboxEntity);
    emailCampaignsRepository.findCampaignsByMailboxId.mockResolvedValue([]);
    emailCampaignsRepository.findActiveMailboxUsage.mockResolvedValue([]);

    const result = await service.findCampaignsForMailbox(
      'mailbox-1',
      organizationId,
    );

    expect(result.campaigns).toEqual([]);
    expect(result.activeLock).toBeNull();
  });

  it('returns not found when fetching campaigns for a missing mailbox', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(
      service.findCampaignsForMailbox('missing', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a mailbox when it is not referenced by campaigns', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue({
      id: 'mailbox-1',
      organizationId,
    } as MailboxEntity);
    emailCampaignsRepository.countByMailboxId.mockResolvedValue(0);
    repository.deleteByIdAndOrganizationId.mockResolvedValue(true);

    await expect(
      service.remove('mailbox-1', organizationId),
    ).resolves.toBeUndefined();

    expect(repository.deleteByIdAndOrganizationId.mock.calls).toEqual([
      ['mailbox-1', organizationId],
    ]);
  });

  it('rejects delete when mailbox is referenced by campaigns', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue({
      id: 'mailbox-1',
      organizationId,
    } as MailboxEntity);
    emailCampaignsRepository.countByMailboxId.mockResolvedValue(2);

    await expect(
      service.remove('mailbox-1', organizationId),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(repository.deleteByIdAndOrganizationId.mock.calls).toHaveLength(0);
  });

  it('returns not found when deleting a missing mailbox', async () => {
    repository.findByIdAndOrganizationId.mockResolvedValue(null);

    await expect(
      service.remove('missing', organizationId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
