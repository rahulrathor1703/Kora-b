import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyConfigRepository } from '../company-config/company-config.repository';
import type { CompanyConfigCategory } from '../company-config/entities/company-config-option.entity';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import { FIELD_KEY_PATTERN } from '../common/field-schema/field-key.pattern';
import { slugifySectionKey } from '../common/field-schema/section-field.utils';
import { normalizeFormColSpan } from '../common/field-schema/form-layout.utils';
import {
  assertFieldStringValidation,
  normalizeFieldStringValidationRules,
} from '../common/field-schema/field-validation.utils';
import type { FieldStoredValue } from '../common/location/location-field.types';
import {
  emptyLocationValue,
  isLocationValue,
  normalizeLocationComponents,
  normalizeLocationInputMode,
} from '../common/location/location-field.types';
import {
  coerceLocationFieldValue,
  isEmptyLocationValue,
  requireScalarFieldValue,
  validateLocationComponents,
} from '../common/location/location-value.validation';
import type {
  BulkDeleteCompaniesDto,
  CompaniesQueryDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateCompanyFieldSchemaDto,
} from './dto/company.dto';
import { FormsService } from '../forms/forms.service';
import { CompanyEntity } from './entities/company.entity';
import {
  CompanyMapper,
  type CompaniesPageResponse,
  type CompanyFieldSchemaResponse,
  type CompanyResponse,
} from './mappers/company.mapper';
import { CompaniesRepository } from './companies.repository';
import {
  BROKER_NAME_FIELD_KEY,
  type CompanyFieldDefinition,
} from './types/company-field-schema';
import {
  getCompanyKnownValidationFields,
  getCompanyValidationFields,
} from './utils/company-validation-fields.util';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COMPANY_FORM_KEY = 'crm.company.create';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly companyConfigRepository: CompanyConfigRepository,
    private readonly companyMapper: CompanyMapper,
    private readonly formsService: FormsService,
    private readonly orgQuotaService: OrgQuotaService,
  ) {}

  async getFieldSchema(
    organizationId: string | null,
  ): Promise<CompanyFieldSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const resolved = await this.formsService.resolveSchema(
      COMPANY_FORM_KEY,
      resolvedOrganizationId,
    );
    const fieldKeysInUse = await this.companiesRepository.findFieldKeysInUse(
      resolvedOrganizationId,
    );

    return {
      fields: resolved.fields as CompanyFieldDefinition[],
      fieldKeysInUse,
      updatedAt: new Date().toISOString(),
    };
  }

  async appendOrgCustomFields(
    fields: CompanyFieldDefinition[],
    organizationId: string | null,
  ): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (fields.length === 0) {
      return;
    }

    await this.formsService.appendOrgExtensionFields(
      COMPANY_FORM_KEY,
      fields,
      resolvedOrganizationId,
    );
  }

  async updateFieldSchema(
    dto: UpdateCompanyFieldSchemaDto,
    organizationId: string | null,
  ): Promise<CompanyFieldSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const existingSchema = await this.requireSchema(resolvedOrganizationId);
    const validatedFields = this.validateFieldSchema(dto.fields);

    const previousKeys = new Set(
      existingSchema.fields.map((field) => field.key),
    );
    const nextKeys = new Set(validatedFields.map((field) => field.key));
    const deletedKeys = [...previousKeys].filter((key) => !nextKeys.has(key));

    if (deletedKeys.includes(BROKER_NAME_FIELD_KEY)) {
      throw new BadRequestException('Broker name field cannot be deleted');
    }

    await this.assertDeletedFieldsHaveNoData(
      resolvedOrganizationId,
      deletedKeys,
      existingSchema.fields,
    );

    existingSchema.fields = validatedFields;

    await this.formsService.updateOrgExtensions(
      COMPANY_FORM_KEY,
      { fields: validatedFields },
      resolvedOrganizationId,
    );

    if (deletedKeys.length > 0) {
      await this.companiesRepository.removeValuesForDeletedFields(
        resolvedOrganizationId,
        deletedKeys,
      );
    }

    const fieldKeysInUse = await this.companiesRepository.findFieldKeysInUse(
      resolvedOrganizationId,
    );

    return {
      fields: validatedFields,
      fieldKeysInUse,
      updatedAt: new Date().toISOString(),
    };
  }

  async findCompanies(
    query: CompaniesQueryDto,
    organizationId: string | null,
  ): Promise<CompaniesPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);
    const searchableFieldKeys = await this.resolveSearchableFieldKeys(
      resolvedOrganizationId,
    );

    const result = await this.companiesRepository.findPaginated(
      resolvedOrganizationId,
      {
        q: query.q,
        page,
        pageSize,
        filters: query.filters,
        searchableFieldKeys,
      },
    );

    return this.companyMapper.toPageResponse(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async findOne(
    id: string,
    organizationId: string | null,
  ): Promise<CompanyResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const company = await this.requireCompany(id, resolvedOrganizationId);
    return this.companyMapper.toResponse(company);
  }

  async create(
    dto: CreateCompanyDto,
    organizationId: string | null,
  ): Promise<CompanyResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'crm.companies',
    );

    const validated = await this.validateCompanyCreateValues(
      resolvedOrganizationId,
      dto.brokerName,
      dto.values,
    );

    await this.assertUniqueBrokerName(
      validated.brokerName,
      resolvedOrganizationId,
    );

    const company = this.companiesRepository.create({
      organizationId: resolvedOrganizationId,
      brokerName: validated.brokerName,
      values: validated.values,
    });

    const saved = await this.companiesRepository.save(company);
    return this.companyMapper.toResponse(saved);
  }

  async validateCompanyCreateValues(
    organizationId: string,
    brokerNameInput: string,
    valuesInput: Record<string, FieldStoredValue>,
  ): Promise<{
    brokerName: string;
    values: Record<string, FieldStoredValue>;
  }> {
    const schema = await this.requireSchema(organizationId);
    const liveCreateFields = getCompanyValidationFields(schema.fields, {
      mode: 'liveCreate',
    });
    const brokerField = schema.fields.find(
      (field) => field.key === BROKER_NAME_FIELD_KEY,
    );
    const brokerLiveField = liveCreateFields.find(
      (field) => field.key === BROKER_NAME_FIELD_KEY,
    );
    const validatedBrokerName = this.validateBrokerNameFromSchema(
      brokerNameInput,
      brokerField,
      { enforceRequired: Boolean(brokerLiveField?.required) },
    );

    const knownFields = getCompanyKnownValidationFields(schema.fields).filter(
      (field) => field.key !== BROKER_NAME_FIELD_KEY,
    );
    const applicableFields = liveCreateFields.filter(
      (field) => field.key !== BROKER_NAME_FIELD_KEY,
    );
    const values = await this.validateCompanyValues(
      applicableFields,
      valuesInput,
      organizationId,
      { partial: false, knownFields },
    );

    return { brokerName: validatedBrokerName, values };
  }

  async validateImportValues(
    organizationId: string,
    brokerNameInput: string,
    valuesInput: Record<string, FieldStoredValue>,
  ): Promise<{
    brokerName: string;
    values: Record<string, FieldStoredValue>;
  }> {
    const schema = await this.requireSchema(organizationId);
    const brokerField = schema.fields.find(
      (field) => field.key === BROKER_NAME_FIELD_KEY,
    );
    const validatedBrokerName = this.validateBrokerNameFromSchema(
      brokerNameInput,
      brokerField,
      { enforceRequired: Boolean(brokerField?.required) },
    );

    const knownFields = getCompanyKnownValidationFields(schema.fields).filter(
      (field) => field.key !== BROKER_NAME_FIELD_KEY,
    );
    const applicableFields = getCompanyValidationFields(schema.fields, {
      mode: 'full',
    }).filter((field) => field.key !== BROKER_NAME_FIELD_KEY);
    const values = await this.validateCompanyValues(
      applicableFields,
      valuesInput,
      organizationId,
      { partial: false, knownFields },
    );

    return { brokerName: validatedBrokerName, values };
  }

  async update(
    id: string,
    dto: UpdateCompanyDto,
    organizationId: string | null,
  ): Promise<CompanyResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const schema = await this.requireSchema(resolvedOrganizationId);
    const company = await this.requireCompany(id, resolvedOrganizationId);

    if (dto.brokerName !== undefined) {
      const brokerField = schema.fields.find(
        (field) => field.key === BROKER_NAME_FIELD_KEY,
      );
      const brokerName = this.validateBrokerNameFromSchema(
        dto.brokerName,
        brokerField,
        { enforceRequired: Boolean(brokerField?.required) },
      );

      await this.assertUniqueBrokerName(
        brokerName,
        resolvedOrganizationId,
        company.id,
      );
      company.brokerName = brokerName;
    }

    if (dto.values !== undefined) {
      const knownFields = getCompanyKnownValidationFields(schema.fields).filter(
        (field) => field.key !== BROKER_NAME_FIELD_KEY,
      );
      const applicableFields = getCompanyValidationFields(schema.fields, {
        mode: 'full',
      }).filter((field) => field.key !== BROKER_NAME_FIELD_KEY);
      const mergedInput = { ...company.values, ...dto.values };
      company.values = await this.validateCompanyValues(
        applicableFields,
        mergedInput,
        resolvedOrganizationId,
        { partial: false, knownFields },
      );
    }

    const saved = await this.companiesRepository.save(company);
    return this.companyMapper.toResponse(saved);
  }

  async remove(id: string, organizationId: string | null): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const deleted = await this.companiesRepository.deleteById(
      id,
      resolvedOrganizationId,
    );

    if (!deleted) {
      throw new NotFoundException('Company not found');
    }
  }

  async bulkRemove(
    dto: BulkDeleteCompaniesDto,
    organizationId: string | null,
  ): Promise<{ deletedCount: number }> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const hasIds = Boolean(dto.ids && dto.ids.length > 0);
    const hasSelectAll = dto.selectAllMatching === true;

    if (hasIds === hasSelectAll) {
      throw new BadRequestException(
        'Provide either ids or selectAllMatching: true, not both',
      );
    }

    if (hasIds) {
      const deletedCount = await this.companiesRepository.deleteByIds(
        resolvedOrganizationId,
        dto.ids ?? [],
      );

      return { deletedCount };
    }

    const searchableFieldKeys = await this.resolveSearchableFieldKeys(
      resolvedOrganizationId,
    );

    const deletedCount = await this.companiesRepository.deleteByListQuery(
      resolvedOrganizationId,
      {
        q: dto.q,
        filters: dto.filters,
        searchableFieldKeys,
      },
    );

    return { deletedCount };
  }

  private async resolveSearchableFieldKeys(
    organizationId: string,
  ): Promise<string[]> {
    const schema = await this.requireSchema(organizationId);

    return schema.fields
      .filter(
        (field) =>
          field.key !== BROKER_NAME_FIELD_KEY &&
          (field.type === 'text' ||
            field.type === 'email' ||
            field.type === 'phone'),
      )
      .map((field) => field.key);
  }

  private async requireSchema(
    organizationId: string,
  ): Promise<{ fields: CompanyFieldDefinition[] }> {
    const fields = await this.formsService.resolveSchemaFields(
      COMPANY_FORM_KEY,
      organizationId,
    );

    return { fields: fields as CompanyFieldDefinition[] };
  }

  private async requireCompany(
    id: string,
    organizationId: string,
  ): Promise<CompanyEntity> {
    const company = await this.companiesRepository.findById(id, organizationId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  private async assertUniqueBrokerName(
    brokerName: string,
    organizationId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.companiesRepository.findByBrokerName(
      brokerName,
      organizationId,
      excludeId,
    );

    if (existing) {
      throw new ConflictException(
        'A company with this broker name already exists',
      );
    }
  }

  private validateFieldSchema(
    fields: CompanyFieldDefinition[],
  ): CompanyFieldDefinition[] {
    const keys = new Set<string>();
    const ids = new Set<string>();

    const normalized = fields.map((field, index) => {
      const label = field.label.trim();

      if (!label) {
        throw new BadRequestException('Every field must have a label');
      }

      if (field.type === 'section') {
        const key = slugifySectionKey(field.key.trim() || label);

        if (!FIELD_KEY_PATTERN.test(key)) {
          throw new BadRequestException(
            `Section key "${key}" must start with a lowercase letter and contain only letters, numbers, and underscores`,
          );
        }

        if (keys.has(key)) {
          throw new BadRequestException(`Duplicate field key "${key}"`);
        }

        if (ids.has(field.id)) {
          throw new BadRequestException(`Duplicate field id "${field.id}"`);
        }

        keys.add(key);
        ids.add(field.id);

        return {
          ...field,
          key,
          label,
          sortOrder: index,
          showInTable: false,
          showInForm: field.showInForm ?? true,
          filterable: false,
          required: false,
          sectionId: undefined,
        };
      }

      const key = field.key.trim();

      if (!FIELD_KEY_PATTERN.test(key)) {
        throw new BadRequestException(
          `Field key "${field.key}" must start with a lowercase letter and contain only letters, numbers, and underscores`,
        );
      }

      if (keys.has(key)) {
        throw new BadRequestException(`Duplicate field key "${key}"`);
      }

      if (ids.has(field.id)) {
        throw new BadRequestException(`Duplicate field id "${field.id}"`);
      }

      keys.add(key);
      ids.add(field.id);

      if (
        field.type === 'select' &&
        (!field.options || field.options.length === 0)
      ) {
        throw new BadRequestException(
          `Select field "${key}" must include at least one option`,
        );
      }

      const { minLength, maxLength, validationType } =
        normalizeFieldStringValidationRules(field, label);

      const locationComponents =
        field.type === 'location'
          ? validateLocationComponents(field.locationComponents, label)
          : undefined;
      const locationInputMode =
        field.type === 'location'
          ? normalizeLocationInputMode(field.locationInputMode)
          : undefined;

      return {
        ...field,
        key,
        label,
        sortOrder: index,
        filterable: field.type === 'location' ? false : field.filterable,
        options: field.options?.map((option) => ({
          value: option.value.trim(),
          label: option.label.trim(),
          color: option.color?.trim() || undefined,
        })),
        locationComponents,
        locationInputMode,
        formColSpan: normalizeFormColSpan(field.type, field.formColSpan, label),
        minLength,
        maxLength,
        validationType,
      };
    });

    const sectionIds = new Set(
      normalized
        .filter((field) => field.type === 'section')
        .map((field) => field.id),
    );

    for (const field of normalized) {
      if (field.type === 'section') {
        continue;
      }

      if (field.sectionId && !sectionIds.has(field.sectionId)) {
        throw new BadRequestException(
          `Field "${field.label}" references an unknown section`,
        );
      }
    }

    const hasBrokerName = normalized.some(
      (field) => field.key === BROKER_NAME_FIELD_KEY && field.system,
    );

    if (!hasBrokerName) {
      throw new BadRequestException(
        'Schema must include system field brokerName',
      );
    }

    return normalized.map((field) => {
      if (field.key === BROKER_NAME_FIELD_KEY) {
        return { ...field, system: true };
      }

      return field;
    });
  }

  private validateBrokerNameFromSchema(
    brokerNameInput: string,
    brokerField: CompanyFieldDefinition | undefined,
    options: { enforceRequired: boolean },
  ): string {
    const brokerName = brokerNameInput.trim();
    const label = brokerField?.label ?? BROKER_NAME_FIELD_KEY;

    if (options.enforceRequired && !brokerName) {
      throw new BadRequestException(`${label} is required`);
    }

    if (brokerName && brokerField) {
      assertFieldStringValidation(label, brokerField, brokerName);
    }

    return brokerName;
  }

  private async validateCompanyValues(
    fields: CompanyFieldDefinition[],
    input: Record<string, FieldStoredValue>,
    organizationId: string,
    options: { partial: boolean; knownFields?: CompanyFieldDefinition[] },
  ): Promise<Record<string, FieldStoredValue>> {
    const knownFields = options.knownFields ?? fields;
    const fieldByKey = new Map(knownFields.map((field) => [field.key, field]));
    const values: Record<string, FieldStoredValue> = {};

    for (const field of fields) {
      if (field.type === 'section') {
        continue;
      }

      const rawValue = input[field.key];

      if (this.isEmptyRawValue(rawValue, field)) {
        if (field.required && !options.partial) {
          throw new BadRequestException(`${field.label} is required`);
        }

        values[field.key] =
          field.type === 'location' ? emptyLocationValue() : null;
        continue;
      }

      values[field.key] = await this.coerceFieldValue(
        field,
        rawValue,
        organizationId,
      );
    }

    for (const key of Object.keys(input)) {
      if (!fieldByKey.has(key)) {
        throw new BadRequestException(`Unknown field "${key}"`);
      }
    }

    return values;
  }

  private async coerceFieldValue(
    field: CompanyFieldDefinition,
    rawValue: FieldStoredValue,
    organizationId: string,
  ): Promise<FieldStoredValue> {
    switch (field.type) {
      case 'location': {
        const components = normalizeLocationComponents(
          field.locationComponents ?? [],
        );
        const value = coerceLocationFieldValue(
          components,
          rawValue,
          field.label,
        );

        if (field.required && isEmptyLocationValue(value)) {
          throw new BadRequestException(`${field.label} is required`);
        }

        return value;
      }
      case 'number': {
        const scalar = requireScalarFieldValue(rawValue, field.label);
        const numericValue =
          typeof scalar === 'number' ? scalar : Number(scalar);
        if (Number.isNaN(numericValue)) {
          throw new BadRequestException(`${field.label} must be a number`);
        }
        return numericValue;
      }
      case 'email': {
        const email = String(requireScalarFieldValue(rawValue, field.label))
          .trim()
          .toLowerCase();
        if (!EMAIL_PATTERN.test(email)) {
          throw new BadRequestException(`${field.label} must be a valid email`);
        }
        return email;
      }
      case 'select': {
        const value = String(
          requireScalarFieldValue(rawValue, field.label),
        ).trim();
        const allowed = field.options?.some((option) => option.value === value);
        if (!allowed) {
          throw new BadRequestException(`Invalid value for ${field.label}`);
        }
        return value;
      }
      case 'company-category': {
        const value = String(
          requireScalarFieldValue(rawValue, field.label),
        ).trim();
        if (!UUID_PATTERN.test(value)) {
          throw new BadRequestException(`Invalid value for ${field.label}`);
        }
        await this.requireConfigOption(value, organizationId, 'category');
        return value;
      }
      case 'company-location': {
        const value = String(
          requireScalarFieldValue(rawValue, field.label),
        ).trim();
        if (!UUID_PATTERN.test(value)) {
          throw new BadRequestException(`Invalid value for ${field.label}`);
        }
        await this.requireConfigOption(value, organizationId, 'location');
        return value;
      }
      case 'date': {
        const value = String(
          requireScalarFieldValue(rawValue, field.label),
        ).trim();
        if (Number.isNaN(Date.parse(value))) {
          throw new BadRequestException(`${field.label} must be a valid date`);
        }
        return value;
      }
      case 'text':
      case 'textarea':
      case 'phone':
      default: {
        const value = String(
          requireScalarFieldValue(rawValue, field.label),
        ).trim();
        assertFieldStringValidation(field.label, field, value);
        return value;
      }
    }
  }

  private isEmptyRawValue(
    rawValue: FieldStoredValue | undefined,
    field: CompanyFieldDefinition,
  ): boolean {
    if (rawValue === undefined || rawValue === null) {
      return true;
    }

    if (typeof rawValue === 'string') {
      return rawValue.trim() === '';
    }

    if (field.type === 'location' && isLocationValue(rawValue)) {
      return isEmptyLocationValue(rawValue);
    }

    return false;
  }

  private async assertDeletedFieldsHaveNoData(
    organizationId: string,
    deletedKeys: string[],
    existingFields: CompanyFieldDefinition[],
  ): Promise<void> {
    if (deletedKeys.length === 0) {
      return;
    }

    const keysInUse =
      await this.companiesRepository.findFieldKeysInUse(organizationId);
    const blockedKeys = deletedKeys.filter((key) => keysInUse.includes(key));

    if (blockedKeys.length === 0) {
      return;
    }

    const labels = blockedKeys.map(
      (key) => existingFields.find((field) => field.key === key)?.label ?? key,
    );

    throw new BadRequestException(
      `Cannot delete ${labels.join(', ')} because existing records already use ${blockedKeys.length === 1 ? 'this field' : 'these fields'}`,
    );
  }

  private async requireConfigOption(
    id: string,
    organizationId: string,
    category: CompanyConfigCategory,
  ): Promise<void> {
    const option = await this.companyConfigRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!option || option.category !== category || !option.isActive) {
      throw new BadRequestException(`Invalid ${category} reference`);
    }
  }
}
