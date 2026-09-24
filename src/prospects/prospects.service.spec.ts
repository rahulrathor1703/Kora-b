import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BantSettingsService } from '../bant-settings/bant-settings.service';
import { createDefaultBantSettingsConfig } from '../bant-settings/types/default-bant-settings';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { FormsService } from '../forms/forms.service';
import { EmailCampaignRecipientsService } from '../email-campaigns/campaign-progress.service';
import { ProspectDeleteRequestsService } from './prospect-delete-requests.service';
import { ProspectMapper } from './mappers/prospect.mapper';
import { ProspectsRepository } from './prospects.repository';
import { ProspectsService } from './prospects.service';
import {
  DEFAULT_PROSPECT_FIELD_SCHEMA,
  PIPELINE_STAGE_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
} from './types/prospect-field-schema';
import type { ProspectFieldDefinition } from './types/prospect-field-schema';

describe('ProspectsService', () => {
  let service: ProspectsService;
  let formsService: jest.Mocked<Pick<FormsService, 'resolveSchemaFields'>>;
  let prospectsRepository: jest.Mocked<
    Pick<
      ProspectsRepository,
      | 'findProspectById'
      | 'saveProspect'
      | 'createEngagement'
      | 'saveEngagement'
      | 'createProspect'
    >
  >;
  let prospectMapper: jest.Mocked<
    Pick<ProspectMapper, 'toProspectResponse' | 'toSearchResult'>
  >;

  const baseFields = DEFAULT_PROSPECT_FIELD_SCHEMA.fields;

  beforeEach(async () => {
    formsService = {
      resolveSchemaFields: jest.fn(),
    };
    prospectsRepository = {
      findProspectById: jest.fn(),
      saveProspect: jest.fn(),
      createEngagement: jest.fn(),
      saveEngagement: jest.fn(),
      createProspect: jest.fn(),
    };
    prospectMapper = {
      toProspectResponse: jest.fn(),
      toSearchResult: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProspectsService,
        { provide: ProspectsRepository, useValue: prospectsRepository },
        { provide: ProspectMapper, useValue: prospectMapper },
        { provide: ProspectDeleteRequestsService, useValue: {} },
        {
          provide: EmailCampaignRecipientsService,
          useValue: {},
        },
        { provide: FormsService, useValue: formsService },
        {
          provide: OrgQuotaService,
          useValue: { assertWithinLimit: jest.fn() },
        },
        {
          provide: BantSettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue({
              config: createDefaultBantSettingsConfig(),
              updatedAt: null,
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ProspectsService);
  });

  describe('validateProspectCreateValues', () => {
    it('validates only live create layout fields, not orphaned root platform fields', async () => {
      const sectionId = '3271646d-10ea-403d-8098-263a509e62f1';
      const layoutFields: ProspectFieldDefinition[] = [
        {
          id: 'c4615808-53c8-40eb-9c0e-5abd23a2b763',
          key: 'first_name',
          label: 'First Name',
          type: 'text',
          required: true,
          sectionId,
          sortOrder: 15,
          showInTable: true,
          showInForm: true,
        },
        {
          id: 'lead-type',
          key: 'lead_type',
          label: 'Lead type',
          type: 'select',
          required: false,
          sectionId,
          sortOrder: 14,
          showInTable: true,
          showInForm: true,
          options: [{ value: 'individual', label: 'Individual' }],
        },
      ];

      formsService.resolveSchemaFields.mockResolvedValue([
        ...baseFields,
        {
          id: '00000000-0000-4000-8000-000000000001',
          key: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          sortOrder: 0,
          showInTable: true,
          showInForm: true,
        },
        ...layoutFields,
      ]);

      const result = await service.validateProspectCreateValues('org-1', {
        leadType: 'individual',
        lead_type: 'individual',
        first_name: 'Param',
        firstName: 'Param',
        workEmail: 'param@example.com',
        phoneNumber: '+911234567890',
        leadSource: 'website',
        leadOwner: 'user-1',
        leadStatus: 'new',
        company: 'Acme',
        companyType: 'broker',
        country: 'india',
        productInterestedIn: ['insureops'],
        requirementType: ['new-platform'],
        requirementDescription: 'Test requirement',
      });

      expect(result.fullName).toBe('Param');
      expect(result.values.first_name).toBe('Param');
      expect(result.values.name).toBeUndefined();
    });

    it('ignores client-supplied BANT-computed score and bantTier', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      const result = await service.validateProspectCreateValues('org-1', {
        leadType: 'individual',
        firstName: 'Jane',
        workEmail: 'jane@example.com',
        phoneNumber: '+911234567890',
        leadSource: 'website',
        leadOwner: 'user-1',
        leadStatus: 'new',
        productInterestedIn: ['insureops'],
        requirementType: ['new-platform'],
        requirementDescription: 'Needs help',
        score: 99,
        bantTier: 'hot',
      });

      expect(result.values.score).toBeUndefined();
      expect(result.values.bantTier).toBeUndefined();
    });

    it('does not require company fields when lead type is individual', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      const result = await service.validateProspectCreateValues('org-1', {
        leadType: 'individual',
        firstName: 'Jane',
        workEmail: 'jane@example.com',
        phoneNumber: '+911234567890',
        leadSource: 'website',
        leadOwner: 'user-1',
        leadStatus: 'new',
        productInterestedIn: ['insureops'],
        requirementType: ['new-platform'],
        requirementDescription: 'Needs help',
      });

      expect(result.fullName).toBe('Jane');
      expect(result.values.company).toBeUndefined();
    });

    it('requires company fields when lead type is company', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      await expect(
        service.validateProspectCreateValues('org-1', {
          leadType: 'company',
          firstName: 'Jane',
          workEmail: 'jane@example.com',
          phoneNumber: '+911234567890',
          leadSource: 'website',
          leadOwner: 'user-1',
          leadStatus: 'new',
          productInterestedIn: ['insureops'],
          requirementType: ['new-platform'],
          requirementDescription: 'Needs help',
        }),
      ).rejects.toThrow(BadRequestException);

      const companyLead = await service.validateProspectCreateValues('org-1', {
        leadType: 'company',
        firstName: 'Jane',
        workEmail: 'jane@example.com',
        phoneNumber: '+911234567890',
        leadSource: 'website',
        leadOwner: 'user-1',
        leadStatus: 'new',
        company: 'Acme',
        companyType: 'broker',
        country: 'india',
        productInterestedIn: ['insureops'],
        requirementType: ['new-platform'],
        requirementDescription: 'Needs help',
      });

      expect(companyLead.fullName).toBe('Jane');
      expect(companyLead.values.company).toBe('Acme');
    });
  });

  describe('validateImportValues', () => {
    function fieldWithMinLength(minLength: number): ProspectFieldDefinition[] {
      const custom: ProspectFieldDefinition = {
        id: '00000000-0000-4000-8999-000000000099',
        key: 'vendor_code',
        label: 'Vendor code',
        type: 'text',
        sortOrder: 99,
        showInTable: true,
        showInForm: true,
        minLength,
      };

      return [...baseFields, custom];
    }

    function minimalValidInput(
      extra: Record<string, string | number | string[]> = {},
    ): Record<string, string | number | string[]> {
      return {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        [PIPELINE_STAGE_FIELD_KEY]: PROTECTED_PIPELINE_STAGE_VALUE,
        leadType: 'individual',
        firstName: 'Jane',
        workEmail: 'jane@example.com',
        phoneNumber: '+911234567890',
        leadSource: 'website',
        leadOwner: 'user-1',
        leadStatus: 'new',
        company: 'Acme Corp',
        companyType: 'broker',
        country: 'india',
        productInterestedIn: ['insureops'],
        requirementType: ['new-platform'],
        requirementDescription: 'Import test requirement',
        vendor_code: 'abcde',
        ...extra,
      };
    }

    it('rejects values that violate minLength on custom text fields', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(fieldWithMinLength(5));

      await expect(
        service.validateImportValues(
          'org-1',
          minimalValidInput({ vendor_code: 'ab' }),
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.validateImportValues(
          'org-1',
          minimalValidInput({ vendor_code: 'ab' }),
        ),
      ).rejects.toThrow(/at least 5 characters/);
    });

    it('accepts values that satisfy minLength', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(fieldWithMinLength(5));

      const result = await service.validateImportValues(
        'org-1',
        minimalValidInput({ vendor_code: 'abcde' }),
      );

      expect(result.values.vendor_code).toBe('abcde');
    });

    it('does not require company columns when lead type is individual', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      const { vendor_code: _vendorCode, ...individualRow } =
        minimalValidInput();
      void _vendorCode;

      const result = await service.validateImportValues('org-1', {
        ...individualRow,
        leadType: 'individual',
        company: '',
        companyType: '',
        country: '',
      });

      expect(result.values.company).toBeUndefined();
    });

    it('requires company fields when lead type is company', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      await expect(
        service.validateImportValues('org-1', {
          ...minimalValidInput(),
          leadType: 'company',
          company: '',
          companyType: 'broker',
          country: 'india',
        }),
      ).rejects.toThrow(/Company is required/);
    });
  });

  describe('updateProspect', () => {
    it('allows partial updates when system identity fields are missing from stored values', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      const prospect = {
        id: 'prospect-1',
        organizationId: 'org-1',
        fullName: 'Paras Thakur',
        email: 'paras@yopmail.com',
        values: {
          leadType: 'individual',
          firstName: 'Paras',
          lastName: 'Thakur',
          workEmail: 'paras@yopmail.com',
          phoneNumber: '+911234567890',
          leadSource: 'website',
          leadOwner: 'user-1',
          leadStatus: 'new',
          bantResponses: {
            need: 'clear',
            budget: 'confirmed',
            timeline: 'near_term',
            authority: 'decision_maker',
          },
          productInterestedIn: ['insureops'],
          requirementType: ['new-platform'],
          requirementDescription: 'Test requirement',
        },
      };

      prospectsRepository.findProspectById.mockResolvedValue(prospect as never);
      prospectsRepository.saveProspect.mockImplementation((entity) =>
        Promise.resolve(entity),
      );
      prospectsRepository.createEngagement.mockReturnValue({
        id: 'eng-1',
      } as never);
      prospectsRepository.saveEngagement.mockResolvedValue({
        id: 'eng-1',
      } as never);
      prospectMapper.toProspectResponse.mockReturnValue({
        id: prospect.id,
        fullName: prospect.fullName,
        email: prospect.email,
        values: {},
        createdAt: '',
        updatedAt: '',
      });

      await service.updateProspect(
        prospect.id,
        { values: { leadStatus: 'contacted' } },
        'org-1',
        null,
      );

      const savedProspect = prospectsRepository.saveProspect.mock.calls[0]?.[0];
      expect(savedProspect?.values.leadStatus).toBe('contacted');
      expect(typeof savedProspect?.values.score).toBe('number');
      expect(savedProspect?.values.bantTier).toBeTruthy();
    });
  });

  describe('createProspectStub', () => {
    it('creates a prospect with name only and default pipeline stage', async () => {
      formsService.resolveSchemaFields.mockResolvedValue(baseFields);

      const createdEntity = {
        id: 'prospect-stub-1',
        fullName: 'Paraksh',
        email: '',
        values: {
          firstName: 'Paraksh',
          leadType: 'individual',
          [PIPELINE_STAGE_FIELD_KEY]: PROTECTED_PIPELINE_STAGE_VALUE,
        },
      };

      prospectsRepository.createProspect.mockReturnValue(
        createdEntity as never,
      );
      prospectsRepository.saveProspect.mockImplementation((entity) =>
        Promise.resolve(entity),
      );
      prospectMapper.toSearchResult.mockReturnValue({
        id: createdEntity.id,
        fullName: createdEntity.fullName,
        email: createdEntity.email,
      });

      const result = await service.createProspectStub(
        { displayName: 'Paraksh' },
        'org-1',
      );

      expect(result).toEqual({
        id: 'prospect-stub-1',
        fullName: 'Paraksh',
        email: '',
      });

      const createArgs = prospectsRepository.createProspect.mock.calls[0]?.[0];
      expect(createArgs?.fullName).toBe('Paraksh');
      expect(createArgs?.email).toBe('');
      expect(createArgs?.values.firstName).toBe('Paraksh');
      expect(createArgs?.values.leadType).toBe('individual');
      expect(createArgs?.values[PIPELINE_STAGE_FIELD_KEY]).toBe(
        PROTECTED_PIPELINE_STAGE_VALUE,
      );
    });

    it('rejects display names shorter than 2 characters', async () => {
      await expect(
        service.createProspectStub({ displayName: 'A' }, 'org-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
