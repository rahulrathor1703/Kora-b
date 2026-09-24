import { Test, TestingModule } from '@nestjs/testing';
import { ListProspectSyncService } from './list-prospect-sync.service';
import { ProspectsRepository } from './prospects.repository';

describe('ListProspectSyncService', () => {
  let service: ListProspectSyncService;
  let repository: jest.Mocked<ProspectsRepository>;

  beforeEach(async () => {
    repository = {
      findSchemaByOrganizationId: jest.fn().mockResolvedValue(null),
      findExistingEmailsByOrganization: jest.fn().mockResolvedValue(new Set()),
      createProspect: jest.fn((data: unknown) => data),
      saveProspects: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ProspectsRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListProspectSyncService,
        { provide: ProspectsRepository, useValue: repository },
      ],
    }).compile();

    service = module.get(ListProspectSyncService);
  });

  it('creates prospects and skips existing emails', async () => {
    repository.findExistingEmailsByOrganization.mockResolvedValue(
      new Set(['existing@example.com']),
    );

    const result = await service.syncRows('org-1', [
      { email: 'new@example.com', fullName: 'New User' },
      { email: 'existing@example.com', fullName: 'Existing User' },
      { email: 'invalid', fullName: 'Bad Email' },
    ]);

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(1);
    expect(repository.saveProspects.mock.calls).toHaveLength(1);
  });

  it('maps manual list rows using detected email column', () => {
    const rows = service.mapManualListRows(
      [
        { key: 'email', label: 'Email' },
        { key: 'name', label: 'Name' },
      ],
      [{ email: 'user@example.com', name: 'User Example' }],
    );

    expect(rows).toEqual([
      {
        email: 'user@example.com',
        fullName: 'User Example',
      },
    ]);
  });

  it('maps contact list members to prospect rows', () => {
    const rows = service.mapContactListMembers([
      {
        email: 'ada@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        company: 'Analytical Engines',
        phone: '555-0100',
        customFields: {},
      },
    ]);

    expect(rows[0]).toEqual({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
      phone: '555-0100',
      designation: 'Analytical Engines',
    });
  });
});
