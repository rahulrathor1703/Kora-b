import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { CompaniesImportService } from '../companies/companies-import.service';
import { CompaniesService } from '../companies/companies.service';
import { DEFAULT_COMPANY_FIELD_SCHEMA } from '../companies/types/company-field-schema';
import { ContactListsService } from '../contact-lists/contact-lists.service';
import { ProspectsImportService } from '../prospects/prospects-import.service';
import { ProspectsService } from '../prospects/prospects.service';
import { DEFAULT_PROSPECT_FIELD_SCHEMA } from '../prospects/types/prospect-field-schema';
import { NotionApiClient } from './notion-api.client';
import { NotionIntegrationsRepository } from './notion-integrations.repository';
import { NotionIntegrationsService } from './notion-integrations.service';

describe('NotionIntegrationsService', () => {
  let service: NotionIntegrationsService;
  let repository: jest.Mocked<NotionIntegrationsRepository>;
  let credentialsCrypto: jest.Mocked<CredentialsCryptoService>;
  let notionApiClient: jest.Mocked<NotionApiClient>;
  let companiesImportService: jest.Mocked<
    Pick<CompaniesImportService, 'importMappedRows'>
  >;
  let prospectsImportService: jest.Mocked<
    Pick<ProspectsImportService, 'importMappedRows'>
  >;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'getFieldSchema' | 'appendOrgCustomFields'>
  >;
  let prospectsService: jest.Mocked<
    Pick<ProspectsService, 'getFieldSchema' | 'appendOrgCustomFields'>
  >;

  beforeEach(async () => {
    repository = {
      findByOrganizationId: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      deleteByOrganizationId: jest.fn(),
    } as unknown as jest.Mocked<NotionIntegrationsRepository>;

    credentialsCrypto = {
      encrypt: jest.fn().mockReturnValue('encrypted-token'),
      decrypt: jest.fn().mockReturnValue({ token: 'secret_test' }),
    } as unknown as jest.Mocked<CredentialsCryptoService>;

    notionApiClient = {
      validateToken: jest.fn().mockResolvedValue(undefined),
      listDatabases: jest.fn(),
      getDatabase: jest.fn(),
      queryAllPages: jest.fn(),
    } as unknown as jest.Mocked<NotionApiClient>;

    companiesImportService = {
      importMappedRows: jest.fn().mockResolvedValue({
        created: 1,
        failed: 0,
        skipped: 1,
        errors: [],
      }),
    };

    prospectsImportService = {
      importMappedRows: jest.fn().mockResolvedValue({
        created: 2,
        failed: 0,
        skipped: 0,
        errors: [],
      }),
    };

    companiesService = {
      getFieldSchema: jest.fn().mockResolvedValue({
        fields: DEFAULT_COMPANY_FIELD_SCHEMA.fields,
      }),
      appendOrgCustomFields: jest.fn().mockResolvedValue(undefined),
    };

    prospectsService = {
      getFieldSchema: jest.fn().mockResolvedValue({
        fields: DEFAULT_PROSPECT_FIELD_SCHEMA.fields,
      }),
      appendOrgCustomFields: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotionIntegrationsService,
        { provide: NotionIntegrationsRepository, useValue: repository },
        { provide: CredentialsCryptoService, useValue: credentialsCrypto },
        { provide: NotionApiClient, useValue: notionApiClient },
        { provide: CompaniesImportService, useValue: companiesImportService },
        { provide: ProspectsImportService, useValue: prospectsImportService },
        { provide: CompaniesService, useValue: companiesService },
        { provide: ProspectsService, useValue: prospectsService },
        {
          provide: ContactListsService,
          useValue: {
            importFromMappedRows: jest.fn().mockResolvedValue({
              created: 1,
              skipped: 0,
              failed: 0,
              errors: [],
            }),
          },
        },
      ],
    }).compile();

    service = module.get(NotionIntegrationsService);
  });

  it('connects after validating the integration token', async () => {
    repository.findByOrganizationId.mockResolvedValue(null);
    repository.create.mockReturnValue({
      organizationId: 'org-1',
    } as never);
    repository.save.mockResolvedValue({} as never);

    const result = await service.connect(
      { integrationToken: 'secret_test' },
      'org-1',
    );

    expect(notionApiClient.validateToken.mock.calls).toEqual([['secret_test']]);
    expect(credentialsCrypto.encrypt.mock.calls[0]?.[0]).toEqual({
      token: 'secret_test',
    });
    expect(result).toEqual({ connected: true });
  });

  it('rejects an invalid integration token', async () => {
    notionApiClient.validateToken.mockRejectedValue(
      new BadRequestException('Notion integration token is invalid.'),
    );

    await expect(
      service.connect({ integrationToken: 'bad' }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
    expect(repository.save.mock.calls).toEqual([]);
  });

  it('disconnects without deleting imported records', async () => {
    repository.deleteByOrganizationId.mockResolvedValue(undefined);

    await expect(service.disconnect('org-1')).resolves.toEqual({
      connected: false,
    });
    expect(repository.deleteByOrganizationId.mock.calls).toEqual([['org-1']]);
  });

  it('imports green company columns and skips duplicates', async () => {
    repository.findByOrganizationId.mockResolvedValue({
      tokenEncrypted: 'encrypted-token',
    } as never);
    notionApiClient.getDatabase.mockResolvedValue({
      id: 'db-1',
      title: 'Brokers',
      properties: [
        { id: 'title', name: 'Company Name', type: 'title' },
        { id: 'notes', name: 'Internal notes', type: 'rich_text' },
      ],
    });
    notionApiClient.queryAllPages.mockResolvedValue([
      {
        properties: {
          'Company Name': {
            id: 'title',
            type: 'title',
            title: [{ plain_text: 'Acme' }],
          },
          'Internal notes': {
            id: 'notes',
            type: 'rich_text',
            rich_text: [{ plain_text: 'Keep private' }],
          },
        },
      },
    ]);

    const result = await service.importRows(
      {
        databaseId: 'db-1',
        destination: 'company',
        excludedPropertyIds: ['notes'],
      },
      'org-1',
    );

    expect(companiesService.appendOrgCustomFields).not.toHaveBeenCalled();
    expect(companiesImportService.importMappedRows).toHaveBeenCalledWith(
      [{ 'Company Name': 'Acme', 'Internal notes': 'Keep private' }],
      { brokerName: 'Company Name' },
      'org-1',
      { onDuplicate: 'skip' },
    );
    expect(result.skipped).toBe(1);
  });

  it('appends org fields instead of resubmitting merged platform schema', async () => {
    const mergedFields = DEFAULT_COMPANY_FIELD_SCHEMA.fields.map(
      (field, index) => ({
        ...field,
        sortOrder: index + 10,
      }),
    );

    companiesService.getFieldSchema.mockResolvedValue({
      fields: mergedFields,
    });

    repository.findByOrganizationId.mockResolvedValue({
      tokenEncrypted: 'encrypted-token',
    } as never);
    notionApiClient.getDatabase.mockResolvedValue({
      id: 'db-1',
      title: 'Brokers',
      properties: [
        { id: 'title', name: 'Company Name', type: 'title' },
        { id: 'region', name: 'Region', type: 'rich_text' },
      ],
    });
    notionApiClient.queryAllPages.mockResolvedValue([
      {
        properties: {
          'Company Name': {
            id: 'title',
            type: 'title',
            title: [{ plain_text: 'Acme' }],
          },
          Region: {
            id: 'region',
            type: 'rich_text',
            rich_text: [{ plain_text: 'West' }],
          },
        },
      },
    ]);

    await service.importRows(
      {
        databaseId: 'db-1',
        destination: 'company',
        excludedPropertyIds: [],
      },
      'org-1',
    );

    expect(companiesService.appendOrgCustomFields).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          key: 'region',
          label: 'Region',
        }),
      ],
      'org-1',
    );
    expect(companiesImportService.importMappedRows).toHaveBeenCalled();
  });

  it('blocks import when a required field is excluded', async () => {
    repository.findByOrganizationId.mockResolvedValue({
      tokenEncrypted: 'encrypted-token',
    } as never);
    notionApiClient.getDatabase.mockResolvedValue({
      id: 'db-1',
      title: 'People',
      properties: [
        { id: 'title', name: 'Name', type: 'title' },
        { id: 'email', name: 'Email', type: 'email' },
      ],
    });

    await expect(
      service.importRows(
        {
          databaseId: 'db-1',
          destination: 'prospect',
          excludedPropertyIds: ['email'],
        },
        'org-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prospectsImportService.importMappedRows).not.toHaveBeenCalled();
  });

  it('requires an existing connection', async () => {
    repository.findByOrganizationId.mockResolvedValue(null);

    await expect(service.listDatabases('org-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
