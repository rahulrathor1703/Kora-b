import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CompanyConfigRepository } from '../company-config/company-config.repository';
import { FileParserService } from '../common/file-parser/file-parser.service';
import { CompaniesImportService } from './companies-import.service';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';
import { CompanyEntity } from './entities/company.entity';
import { DEFAULT_COMPANY_FIELD_SCHEMA } from './types/company-field-schema';
import type { FieldStoredValue } from '../common/location/location-field.types';

describe('CompaniesImportService', () => {
  let service: CompaniesImportService;
  let fileParserService: jest.Mocked<FileParserService>;
  let companiesRepository: jest.Mocked<CompaniesRepository>;
  let companiesService: jest.Mocked<
    Pick<CompaniesService, 'getFieldSchema' | 'validateImportValues'>
  >;

  function makeFile(content: string): Express.Multer.File {
    const buffer = Buffer.from(content, 'utf8');

    return {
      fieldname: 'file',
      originalname: 'companies.csv',
      encoding: '7bit',
      mimetype: 'text/csv',
      size: buffer.length,
      buffer,
      destination: '',
      filename: 'companies.csv',
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

    companiesRepository = {
      findExistingBrokerNamesByOrganization: jest.fn(),
      create: jest.fn((data: Partial<CompanyEntity>) => data as CompanyEntity),
      saveMany: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<CompaniesRepository>;

    companiesService = {
      getFieldSchema: jest.fn(),
      validateImportValues: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesImportService,
        { provide: FileParserService, useValue: fileParserService },
        { provide: CompaniesRepository, useValue: companiesRepository },
        { provide: CompaniesService, useValue: companiesService },
        {
          provide: CompanyConfigRepository,
          useValue: {
            findAllByOrganizationId: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get(CompaniesImportService);

    companiesService.getFieldSchema.mockResolvedValue({
      fields: DEFAULT_COMPANY_FIELD_SCHEMA.fields,
      fieldKeysInUse: [],
      updatedAt: new Date().toISOString(),
    });
    companiesRepository.findExistingBrokerNamesByOrganization.mockResolvedValue(
      new Set(['existing broker']),
    );
    companiesService.validateImportValues.mockImplementation(
      (
        _organizationId: string,
        brokerName: string,
        values: Record<string, FieldStoredValue>,
      ) => Promise.resolve({ brokerName, values }),
    );
  });

  it('imports valid rows and fails duplicate broker names', async () => {
    fileParserService.parseFile.mockResolvedValue({
      columns: ['Broker Name'],
      rows: [
        { 'Broker Name': 'Fresh Broker' },
        { 'Broker Name': 'Existing Broker' },
        { 'Broker Name': 'Fresh Broker' },
      ],
    });

    const result = await service.importRows(
      makeFile('Broker Name\n'),
      { brokerName: 'Broker Name' },
      'org-1',
    );

    expect(result.created).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'brokerName',
          message: 'Company with this broker name already exists',
        }),
        expect.objectContaining({
          key: 'brokerName',
          message: 'Duplicate broker name in file',
        }),
      ]),
    );
    expect(companiesRepository.saveMany.mock.calls).toHaveLength(1);
  });

  it('rejects missing required broker name mapping', async () => {
    fileParserService.parseFile.mockResolvedValue({
      columns: ['Remarks'],
      rows: [{ Remarks: 'Note' }],
    });

    await expect(
      service.importRows(makeFile('Remarks\n'), {}, 'org-1'),
    ).rejects.toThrow(BadRequestException);
  });
});
