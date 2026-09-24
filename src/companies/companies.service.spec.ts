import { Test, TestingModule } from '@nestjs/testing';
import { CompanyConfigRepository } from '../company-config/company-config.repository';
import { FormsService } from '../forms/forms.service';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';
import { CompanyMapper } from './mappers/company.mapper';
import {
  BROKER_NAME_FIELD_KEY,
  type CompanyFieldDefinition,
} from './types/company-field-schema';

describe('CompaniesService', () => {
  let service: CompaniesService;
  let formsService: jest.Mocked<Pick<FormsService, 'resolveSchemaFields'>>;

  function field(
    partial: Partial<CompanyFieldDefinition> &
      Pick<CompanyFieldDefinition, 'key'>,
  ): CompanyFieldDefinition {
    return {
      id: partial.id ?? '00000000-0000-4000-8000-000000000099',
      label: partial.label ?? partial.key,
      type: partial.type ?? 'text',
      sortOrder: partial.sortOrder ?? 0,
      showInTable: partial.showInTable ?? true,
      showInForm: partial.showInForm ?? true,
      ...partial,
    };
  }

  beforeEach(async () => {
    formsService = {
      resolveSchemaFields: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: CompaniesRepository,
          useValue: {
            findFieldKeysInUse: jest.fn(),
          },
        },
        { provide: CompanyConfigRepository, useValue: {} },
        { provide: CompanyMapper, useValue: {} },
        { provide: FormsService, useValue: formsService },
        {
          provide: OrgQuotaService,
          useValue: { assertWithinLimit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(CompaniesService);
  });

  describe('validateCompanyCreateValues', () => {
    it('validates only live create layout fields, including tenant custom fields', async () => {
      const sectionId = '00000000-0000-4000-9001-000000000001';
      formsService.resolveSchemaFields.mockResolvedValue([
        field({
          key: BROKER_NAME_FIELD_KEY,
          label: 'Company Name',
          required: true,
          system: true,
          sectionId,
        }),
        field({
          key: 'custom_note',
          label: 'Custom Note',
          required: true,
          sectionId,
        }),
        field({
          key: 'orphan_field',
          label: 'Orphan',
          required: true,
          showInForm: true,
        }),
      ]);

      await expect(
        service.validateCompanyCreateValues('org-1', 'Acme Corp', {}),
      ).rejects.toThrow(/Custom Note is required/);

      const result = await service.validateCompanyCreateValues(
        'org-1',
        'Acme Corp',
        { custom_note: 'hello' },
      );

      expect(result.values.custom_note).toBe('hello');
    });

    it('applies broker name string rules from schema', async () => {
      const sectionId = '00000000-0000-4000-9001-000000000001';
      formsService.resolveSchemaFields.mockResolvedValue([
        field({
          key: BROKER_NAME_FIELD_KEY,
          label: 'Company Name',
          required: true,
          system: true,
          sectionId,
          minLength: 5,
        }),
      ]);

      await expect(
        service.validateCompanyCreateValues('org-1', 'Acme', {}),
      ).rejects.toThrow(/at least 5 characters/);
    });

    it('does not require broker name when removed from live create layout', async () => {
      formsService.resolveSchemaFields.mockResolvedValue([
        field({
          key: BROKER_NAME_FIELD_KEY,
          label: 'Company Name',
          required: true,
          system: true,
          showInForm: false,
        }),
        field({
          key: 'website',
          label: 'Website',
          sectionId: 'section-1',
        }),
      ]);

      const result = await service.validateCompanyCreateValues('org-1', '', {});

      expect(result.brokerName).toBe('');
    });
  });

  describe('validateImportValues', () => {
    it('validates off-canvas tenant fields in full mode', async () => {
      formsService.resolveSchemaFields.mockResolvedValue([
        field({
          key: BROKER_NAME_FIELD_KEY,
          label: 'Company Name',
          required: true,
        }),
        field({
          key: 'orphan_field',
          label: 'Orphan',
          required: true,
        }),
      ]);

      await expect(
        service.validateImportValues('org-1', 'Acme Corp', {}),
      ).rejects.toThrow(/Orphan is required/);
    });

    it('uses schema required for broker name on import', async () => {
      formsService.resolveSchemaFields.mockResolvedValue([
        field({
          key: BROKER_NAME_FIELD_KEY,
          label: 'Company Name',
          required: false,
        }),
      ]);

      const result = await service.validateImportValues('org-1', '', {});

      expect(result.brokerName).toBe('');
    });
  });
});
