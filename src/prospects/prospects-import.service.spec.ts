import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { FileParserService } from '../common/file-parser/file-parser.service';
import { ProspectsImportService } from './prospects-import.service';
import { ProspectsRepository } from './prospects.repository';
import { ProspectsService } from './prospects.service';
import { ProspectEntity } from './entities/prospect.entity';
import { DEFAULT_PROSPECT_FIELD_SCHEMA } from './types/prospect-field-schema';
import type { FieldStoredValue } from '../common/location/location-field.types';

describe('ProspectsImportService', () => {
  let service: ProspectsImportService;
  let fileParserService: jest.Mocked<FileParserService>;
  let prospectsRepository: jest.Mocked<ProspectsRepository>;
  let prospectsService: jest.Mocked<
    Pick<ProspectsService, 'validateImportValues'>
  >;

  function makeFile(content: string): Express.Multer.File {
    const buffer = Buffer.from(content, 'utf8');

    return {
      fieldname: 'file',
      originalname: 'prospects.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
      destination: '',
      filename: 'prospects.csv',
      path: '',
      stream: null as never,
    };
  }

  beforeEach(async () => {
    fileParserService = {
      assertSupportedCrmImportFile: jest.fn(
        (file: Express.Multer.File) => file,
      ),
      parseFile: jest.fn(),
      suggestCrmFieldMapping: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<FileParserService>;

    prospectsRepository = {
      findSchemaByOrganizationId: jest.fn(),
      findExistingEmailsByOrganization: jest.fn(),
      createProspect: jest.fn(
        (data: Partial<ProspectEntity>) => data as ProspectEntity,
      ),
      saveProspects: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ProspectsRepository>;

    prospectsService = {
      validateImportValues: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectsImportService,
        { provide: FileParserService, useValue: fileParserService },
        { provide: ProspectsRepository, useValue: prospectsRepository },
        { provide: ProspectsService, useValue: prospectsService },
      ],
    }).compile();

    service = module.get(ProspectsImportService);

    prospectsRepository.findSchemaByOrganizationId.mockResolvedValue({
      fields: DEFAULT_PROSPECT_FIELD_SCHEMA.fields,
    } as never);
    prospectsRepository.findExistingEmailsByOrganization.mockResolvedValue(
      new Set(['existing@example.com']),
    );
    prospectsService.validateImportValues.mockImplementation(
      (_organizationId: string, values: Record<string, FieldStoredValue>) => {
        const fullName = values.fullName;
        const email = values.email;

        return Promise.resolve({
          fullName: typeof fullName === 'string' ? fullName : '',
          email: typeof email === 'string' ? email.toLowerCase() : '',
          values,
        });
      },
    );
  });

  it('imports valid rows and fails duplicates', async () => {
    fileParserService.parseFile.mockResolvedValue({
      columns: ['Name', 'Email'],
      rows: [
        { Name: 'New Person', Email: 'new@example.com' },
        { Name: 'Existing Person', Email: 'existing@example.com' },
        { Name: 'Duplicate', Email: 'new@example.com' },
      ],
    });

    const result = await service.importRows(
      makeFile('Name,Email\n'),
      { fullName: 'Name', email: 'Email' },
      'org-1',
    );

    expect(result.created).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'email',
          message: 'Prospect with this email already exists',
        }),
        expect.objectContaining({
          key: 'email',
          message: 'Duplicate email in file',
        }),
      ]),
    );
    expect(prospectsRepository.saveProspects.mock.calls).toHaveLength(1);
  });

  it('returns row issues during preview when mapping is provided', async () => {
    fileParserService.parseFile.mockResolvedValue({
      columns: ['Name', 'Email'],
      rows: [{ Name: 'Existing Person', Email: 'existing@example.com' }],
    });

    const preview = await service.previewImport(
      makeFile('Name,Email\n'),
      'org-1',
      { fullName: 'Name', email: 'Email' },
    );

    expect(preview.rowIssues).toEqual([
      expect.objectContaining({
        row: 2,
        message: 'Prospect with this email already exists',
      }),
    ]);
  });

  it('rejects missing required mappings', async () => {
    fileParserService.parseFile.mockResolvedValue({
      columns: ['Name'],
      rows: [{ Name: 'Jane Doe' }],
    });

    await expect(
      service.importRows(makeFile('Name\n'), { fullName: 'Name' }, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
