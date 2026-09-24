import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { BantSettingsService } from '../bant-settings/bant-settings.service';
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
  CreateProspectDto,
  CreateProspectStubDto,
  CreateProspectEngagementDto,
  FollowUpsQueryDto,
  ProspectsQueryDto,
  UpdateProspectDto,
  UpdateProspectFieldSchemaDto,
} from './dto/prospect.dto';
import { FormsService } from '../forms/forms.service';
import { ProspectEntity } from './entities/prospect.entity';
import {
  ProspectMapper,
  type ProspectEngagementResponse,
  type ProspectFieldSchemaResponse,
  type ProspectResponse,
  type ProspectSearchResultResponse,
  type ProspectsPageResponse,
  type PipelineSummaryResponse,
} from './mappers/prospect.mapper';
import { ProspectsRepository } from './prospects.repository';
import { ProspectDeleteRequestsService } from './prospect-delete-requests.service';
import { EmailCampaignRecipientsService } from '../email-campaigns/campaign-progress.service';
import type { ProspectCampaignListResponse } from '../email-campaigns/mappers/prospect-campaign.mapper';
import {
  LEAD_STATUS_FIELD_KEY,
  PIPELINE_STAGE_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
  type ProspectFieldDefinition,
} from './types/prospect-field-schema';
import { normalizeProspectFieldSchemaFields } from './utils/prospect-schema-normalize.util';
import {
  applyProspectBantComputedFieldValues,
  isProspectBantComputedField,
  isProspectBantComputedFieldKey,
} from './utils/prospect-bant-computed-fields.util';
import {
  getProspectKnownValidationFields,
  getProspectValidationFields,
} from './utils/prospect-validation-fields.util';
import {
  applyDefaultProspectPipelineStage,
  findPipelineStageField,
  resolveProspectEmail,
  resolveProspectFullName,
} from './utils/prospect-identity.util';
import { PROSPECT_LEAD_TYPE_FIELD_KEYS } from './utils/prospect-lead-type-fields.util';
import {
  isValidFollowUpFieldKey,
  resolveFollowUpFieldKey,
} from './types/follow-up-field';
import {
  assertPipelineStageSchemaChangeAllowed,
  isPlatformPipelineStageValue,
} from './utils/pipeline-stage-schema.util';
import type { FormFieldOption } from '../forms/types/form-schema.types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROSPECT_FORM_KEY = 'crm.prospect.create';

@Injectable()
export class ProspectsService {
  constructor(
    private readonly prospectsRepository: ProspectsRepository,
    private readonly prospectMapper: ProspectMapper,
    private readonly deleteRequestsService: ProspectDeleteRequestsService,
    private readonly emailCampaignRecipientsService: EmailCampaignRecipientsService,
    private readonly formsService: FormsService,
    private readonly orgQuotaService: OrgQuotaService,
    private readonly bantSettingsService: BantSettingsService,
  ) {}

  async getFieldSchema(
    organizationId: string | null,
  ): Promise<ProspectFieldSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const resolved = await this.formsService.resolveSchema(
      PROSPECT_FORM_KEY,
      resolvedOrganizationId,
    );
    const fieldKeysInUse = await this.prospectsRepository.findFieldKeysInUse(
      resolvedOrganizationId,
    );

    return {
      fields: normalizeProspectFieldSchemaFields(
        resolved.fields as ProspectFieldDefinition[],
      ),
      fieldKeysInUse,
      updatedAt: new Date().toISOString(),
    };
  }

  async appendOrgCustomFields(
    fields: ProspectFieldDefinition[],
    organizationId: string | null,
  ): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    if (fields.length === 0) {
      return;
    }

    await this.formsService.appendOrgExtensionFields(
      PROSPECT_FORM_KEY,
      fields,
      resolvedOrganizationId,
    );
  }

  async updateFieldSchema(
    dto: UpdateProspectFieldSchemaDto,
    organizationId: string | null,
  ): Promise<ProspectFieldSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const existingSchema = await this.requireSchema(resolvedOrganizationId);
    const validatedFields = this.validateFieldSchema(dto.fields);

    const previousKeys = new Set(
      existingSchema.fields.map((field) => field.key),
    );
    const nextKeys = new Set(validatedFields.map((field) => field.key));
    const deletedKeys = [...previousKeys].filter((key) => !nextKeys.has(key));

    if (deletedKeys.includes(LEAD_STATUS_FIELD_KEY)) {
      throw new BadRequestException(
        'Pipeline stage field Lead Status cannot be deleted',
      );
    }

    if (deletedKeys.includes('fullName')) {
      throw new BadRequestException('Name field cannot be deleted');
    }

    if (deletedKeys.includes('email')) {
      throw new BadRequestException('Email field cannot be deleted');
    }

    await this.assertDeletedFieldsHaveNoData(
      resolvedOrganizationId,
      deletedKeys,
      existingSchema.fields,
    );

    const platformPipelineBaseline =
      await this.formsService.getPublishedPipelineStageBaselineOptions(
        PROSPECT_FORM_KEY,
      );

    assertPipelineStageSchemaChangeAllowed(
      platformPipelineBaseline,
      validatedFields,
    );

    await this.validateRemovedPipelineStages(
      resolvedOrganizationId,
      existingSchema.fields,
      validatedFields,
      platformPipelineBaseline,
    );

    existingSchema.fields = validatedFields;

    await this.formsService.updateOrgExtensions(
      PROSPECT_FORM_KEY,
      { fields: validatedFields },
      resolvedOrganizationId,
    );

    if (deletedKeys.length > 0) {
      await this.prospectsRepository.removeValuesForDeletedFields(
        resolvedOrganizationId,
        deletedKeys,
      );
    }

    const fieldKeysInUse = await this.prospectsRepository.findFieldKeysInUse(
      resolvedOrganizationId,
    );

    return {
      fields: validatedFields,
      fieldKeysInUse,
      updatedAt: new Date().toISOString(),
    };
  }

  async findOneProspect(
    id: string,
    organizationId: string | null,
  ): Promise<ProspectResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const prospect = await this.requireProspect(id, resolvedOrganizationId);
    await this.syncProspectBantComputedFields(
      resolvedOrganizationId,
      prospect,
      { persistIfMissing: true },
    );
    return this.prospectMapper.toProspectResponse(prospect);
  }

  async findProspects(
    query: ProspectsQueryDto,
    organizationId: string | null,
  ): Promise<ProspectsPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const schema = await this.requireSchema(resolvedOrganizationId);
    const followUpFieldKey = await this.resolveFollowUpFieldKeyForFilter(
      resolvedOrganizationId,
      query.followUpRange,
    );
    const pipelineStageField = findPipelineStageField(schema.fields);

    const result = await this.prospectsRepository.findPaginated(
      resolvedOrganizationId,
      {
        q: query.q,
        page,
        pageSize,
        filters: query.filters,
        pipelineStageFieldKey: pipelineStageField?.key,
        followUpRange: followUpFieldKey ? query.followUpRange : undefined,
        followUpFieldKey: followUpFieldKey ?? undefined,
      },
    );

    await this.syncProspectBantComputedFieldsForList(
      resolvedOrganizationId,
      result.items,
    );

    return this.prospectMapper.toProspectsPageResponse(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async findFollowUps(
    query: FollowUpsQueryDto,
    organizationId: string | null,
  ): Promise<ProspectsPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const schema = await this.requireSchema(resolvedOrganizationId);
    const fieldKey = resolveFollowUpFieldKey(schema.fields);

    if (!fieldKey || !isValidFollowUpFieldKey(fieldKey, schema.fields)) {
      return this.prospectMapper.toProspectsPageResponse([], 0, page, pageSize);
    }

    const result = await this.prospectsRepository.findFollowUpsPaginated(
      resolvedOrganizationId,
      {
        range: query.range,
        page,
        pageSize,
        fieldKey,
      },
    );

    return this.prospectMapper.toProspectsPageResponse(
      result.items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async getPipelineSummary(
    organizationId: string | null,
    followUpRange?: ProspectsQueryDto['followUpRange'],
  ): Promise<PipelineSummaryResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const schema = await this.requireSchema(resolvedOrganizationId);
    const stageField = findPipelineStageField(schema.fields);

    if (!stageField?.options?.length) {
      return { stages: [] };
    }

    const followUpFieldKey = await this.resolveFollowUpFieldKeyForFilter(
      resolvedOrganizationId,
      followUpRange,
    );

    const counts =
      await this.prospectsRepository.countProspectsGroupedByFieldValue(
        resolvedOrganizationId,
        stageField.key,
        followUpFieldKey
          ? {
              followUpRange,
              followUpFieldKey,
            }
          : undefined,
      );

    const countByValue = new Map<string, number>();
    let unassignedCount = 0;

    for (const row of counts) {
      if (row.value === null || row.value.trim() === '') {
        unassignedCount += row.count;
      } else {
        countByValue.set(row.value, row.count);
      }
    }

    const prospectCount =
      (countByValue.get(PROTECTED_PIPELINE_STAGE_VALUE) ?? 0) + unassignedCount;
    countByValue.set(PROTECTED_PIPELINE_STAGE_VALUE, prospectCount);

    const stages = stageField.options.map((option) => ({
      value: option.value,
      label: option.label,
      color: option.color,
      count: countByValue.get(option.value) ?? 0,
    }));

    return { stages };
  }

  async createProspect(
    dto: CreateProspectDto,
    organizationId: string | null,
  ): Promise<ProspectResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'crm.prospects',
    );

    const validated = await this.validateProspectCreateValues(
      resolvedOrganizationId,
      dto.values,
    );

    const prospect = this.prospectsRepository.createProspect({
      organizationId: resolvedOrganizationId,
      fullName: validated.fullName,
      email: validated.email,
      values: validated.values,
    });

    const saved = await this.prospectsRepository.saveProspect(prospect);
    return this.prospectMapper.toProspectResponse(saved);
  }

  async createProspectStub(
    dto: CreateProspectStubDto,
    organizationId: string | null,
  ): Promise<ProspectSearchResultResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const displayName = dto.displayName.trim();

    if (displayName.length < 2) {
      throw new BadRequestException(
        'Display name must be at least 2 characters',
      );
    }

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'crm.prospects',
    );

    const schema = await this.requireSchema(resolvedOrganizationId);
    const fields = schema.fields;
    const values: Record<string, FieldStoredValue> = {};

    const firstNameField = fields.find(
      (field) => field.key === 'firstName' || field.key === 'first_name',
    );
    if (firstNameField) {
      values[firstNameField.key] = displayName;
    } else if (fields.some((field) => field.key === 'fullName')) {
      values.fullName = displayName;
    } else if (fields.some((field) => field.key === 'name')) {
      values.name = displayName;
    } else {
      values.firstName = displayName;
    }

    for (const leadKey of PROSPECT_LEAD_TYPE_FIELD_KEYS) {
      if (fields.some((field) => field.key === leadKey)) {
        values[leadKey] = 'individual';
        break;
      }
    }

    applyDefaultProspectPipelineStage(fields, values);

    const fullName = resolveProspectFullName(fields, values);
    const email = resolveProspectEmail(fields, values);

    const prospect = this.prospectsRepository.createProspect({
      organizationId: resolvedOrganizationId,
      fullName,
      email,
      values,
    });

    const saved = await this.prospectsRepository.saveProspect(prospect);
    return this.prospectMapper.toSearchResult(saved);
  }

  async validateProspectCreateValues(
    organizationId: string,
    input: Record<string, FieldStoredValue>,
  ): Promise<{
    fullName: string;
    email: string;
    values: Record<string, FieldStoredValue>;
  }> {
    const schema = await this.requireSchema(organizationId);
    const knownFields = getProspectKnownValidationFields(schema.fields);
    const applicableFields = getProspectValidationFields(schema.fields, input, {
      mode: 'liveCreate',
      layoutFields: schema.fields,
    });
    const values = this.validateProspectValues(applicableFields, input, {
      partial: false,
      knownFields,
    });
    applyDefaultProspectPipelineStage(schema.fields, values);

    return {
      fullName: resolveProspectFullName(schema.fields, values),
      email: resolveProspectEmail(schema.fields, values),
      values,
    };
  }

  async validateImportValues(
    organizationId: string,
    input: Record<string, FieldStoredValue>,
  ): Promise<{
    fullName: string;
    email: string;
    values: Record<string, FieldStoredValue>;
  }> {
    const schema = await this.requireSchema(organizationId);
    const knownFields = getProspectKnownValidationFields(schema.fields);
    const applicableFields = getProspectValidationFields(schema.fields, input, {
      mode: 'full',
      layoutFields: schema.fields,
    });
    const values = this.validateProspectValues(applicableFields, input, {
      partial: false,
      knownFields,
    });
    applyDefaultProspectPipelineStage(schema.fields, values);

    return {
      fullName: resolveProspectFullName(schema.fields, values),
      email: resolveProspectEmail(schema.fields, values),
      values,
    };
  }

  async updateProspect(
    id: string,
    dto: UpdateProspectDto,
    organizationId: string | null,
    updatedById: string | null,
  ): Promise<ProspectResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const schema = await this.requireSchema(resolvedOrganizationId);
    const prospect = await this.requireProspect(id, resolvedOrganizationId);
    const stageField = findPipelineStageField(schema.fields);
    const stageFieldKey = stageField?.key ?? PIPELINE_STAGE_FIELD_KEY;

    const previousStageValue = this.extractOptionalString(
      prospect.values[stageFieldKey],
    );

    const mergedInput = this.mergeProspectUpdateInput(
      prospect,
      dto.values,
      schema.fields,
    );
    const knownFields = getProspectKnownValidationFields(schema.fields);
    const applicableFields = getProspectValidationFields(
      schema.fields,
      mergedInput,
      {
        mode: 'full',
        layoutFields: schema.fields,
      },
    );
    const values = this.validateProspectValues(applicableFields, mergedInput, {
      partial: false,
      knownFields,
    });
    await this.applyBantComputedFieldsToValues(resolvedOrganizationId, values);

    prospect.fullName = resolveProspectFullName(schema.fields, values);
    prospect.email = resolveProspectEmail(schema.fields, values);
    prospect.values = values;

    const saved = await this.prospectsRepository.saveProspect(prospect);

    const nextStageValue = this.extractOptionalString(values[stageFieldKey]);

    if (previousStageValue !== nextStageValue) {
      await this.logStatusChangeEngagement({
        prospectId: saved.id,
        fromStageValue: previousStageValue,
        toStageValue: nextStageValue,
        stageField: stageField,
        createdById: updatedById,
      });
    }

    return this.prospectMapper.toProspectResponse(saved);
  }

  async deleteProspect(
    id: string,
    organizationId: string | null,
  ): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.deleteRequestsService.cancelPendingForProspect(
      id,
      resolvedOrganizationId,
    );

    const deleted = await this.prospectsRepository.deleteProspect(
      id,
      resolvedOrganizationId,
    );

    if (!deleted) {
      throw new NotFoundException('Prospect not found');
    }
  }

  async searchProspects(
    q: string,
    limit: number,
    organizationId: string | null,
  ): Promise<ProspectSearchResultResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const results = await this.prospectsRepository.searchProspects(
      resolvedOrganizationId,
      q,
      limit,
    );

    return results.map((result) => this.prospectMapper.toSearchResult(result));
  }

  async createEngagement(
    prospectId: string,
    dto: CreateProspectEngagementDto,
    organizationId: string | null,
    createdById: string | null,
  ): Promise<ProspectEngagementResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    await this.requireProspect(prospectId, resolvedOrganizationId);

    const engagement = this.prospectsRepository.createEngagement({
      prospectId,
      type: dto.type,
      discussion: dto.discussion.trim(),
      outcome: dto.outcome,
      nextStep: dto.nextStep?.trim() || null,
      createdById,
    });

    const saved = await this.prospectsRepository.saveEngagement(engagement);
    const loaded =
      (await this.prospectsRepository.findEngagementById(saved.id)) ?? saved;

    return this.prospectMapper.toEngagementResponse(loaded);
  }

  async listEngagements(
    prospectId: string,
    organizationId: string | null,
  ): Promise<ProspectEngagementResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    await this.requireProspect(prospectId, resolvedOrganizationId);

    const engagements =
      await this.prospectsRepository.findEngagementsByProspectId(prospectId);

    return this.prospectMapper.toEngagementResponseList(engagements);
  }

  async listProspectCampaigns(
    prospectId: string,
    organizationId: string | null,
  ): Promise<ProspectCampaignListResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const prospect = await this.requireProspect(
      prospectId,
      resolvedOrganizationId,
    );

    return this.emailCampaignRecipientsService.listByProspectEmail(
      resolvedOrganizationId,
      prospect.email,
    );
  }

  private async requireSchema(
    organizationId: string,
  ): Promise<{ fields: ProspectFieldDefinition[] }> {
    const fields = await this.formsService.resolveSchemaFields(
      PROSPECT_FORM_KEY,
      organizationId,
    );

    return {
      fields: normalizeProspectFieldSchemaFields(
        fields as ProspectFieldDefinition[],
      ),
    };
  }

  private async resolveFollowUpFieldKeyForFilter(
    organizationId: string,
    followUpRange?: ProspectsQueryDto['followUpRange'],
  ): Promise<string | null> {
    if (!followUpRange) {
      return null;
    }

    const schema = await this.requireSchema(organizationId);
    const fieldKey = resolveFollowUpFieldKey(schema.fields);

    if (!fieldKey || !isValidFollowUpFieldKey(fieldKey, schema.fields)) {
      return null;
    }

    return fieldKey;
  }

  private async requireProspect(
    id: string,
    organizationId: string,
  ): Promise<ProspectEntity> {
    const prospect = await this.prospectsRepository.findProspectById(
      id,
      organizationId,
    );

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    return prospect;
  }

  private validateFieldSchema(
    fields: ProspectFieldDefinition[],
  ): ProspectFieldDefinition[] {
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
          pipelineStage: false,
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

    const hasFullName = normalized.some(
      (field) => field.key === 'fullName' && field.system,
    );
    const hasEmail = normalized.some(
      (field) => field.key === 'email' && field.system,
    );

    if (!hasFullName || !hasEmail) {
      throw new BadRequestException(
        'Schema must include system fields fullName and email',
      );
    }

    const withSystemFlags = normalized.map((field) => {
      if (field.key === 'fullName' || field.key === 'email') {
        return { ...field, system: true };
      }

      if (field.key === LEAD_STATUS_FIELD_KEY) {
        return { ...field, pipelineStage: true, system: false };
      }

      return field;
    });

    const pipelineReady = normalizeProspectFieldSchemaFields(withSystemFlags);
    const pipelineStageField = findPipelineStageField(pipelineReady);

    if (!pipelineStageField) {
      throw new BadRequestException(
        'Schema must include Lead Status as the pipeline stage field',
      );
    }

    const hasProtectedStage = pipelineStageField.options?.some(
      (option) => option.value === PROTECTED_PIPELINE_STAGE_VALUE,
    );

    if (!hasProtectedStage) {
      throw new BadRequestException(
        'Pipeline must always include the New lead status stage',
      );
    }

    return pipelineReady;
  }

  private async assertDeletedFieldsHaveNoData(
    organizationId: string,
    deletedKeys: string[],
    existingFields: ProspectFieldDefinition[],
  ): Promise<void> {
    if (deletedKeys.length === 0) {
      return;
    }

    const keysInUse =
      await this.prospectsRepository.findFieldKeysInUse(organizationId);
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

  private async validateRemovedPipelineStages(
    organizationId: string,
    previousFields: ProspectFieldDefinition[],
    nextFields: ProspectFieldDefinition[],
    platformBaselineOptions: FormFieldOption[],
  ): Promise<void> {
    const previousStageField = findPipelineStageField(previousFields);
    const nextStageField = findPipelineStageField(nextFields);

    if (!previousStageField?.options || !nextStageField?.options) {
      return;
    }

    const nextOptionValues = new Set(
      nextStageField.options.map((option) => option.value),
    );

    const removedOptions = previousStageField.options.filter(
      (option) => !nextOptionValues.has(option.value),
    );

    for (const removedOption of removedOptions) {
      if (
        isPlatformPipelineStageValue(
          removedOption.value,
          platformBaselineOptions,
        )
      ) {
        throw new BadRequestException(
          `Platform pipeline stage "${removedOption.label}" cannot be deleted`,
        );
      }

      const stageFieldKey = nextStageField.key;
      const count = await this.prospectsRepository.countProspectsByFieldValue(
        organizationId,
        stageFieldKey,
        removedOption.value,
      );

      if (count > 0) {
        throw new BadRequestException(
          `Cannot delete stage "${removedOption.label}" — ${count} prospect${count === 1 ? '' : 's'} still in this stage`,
        );
      }
    }
  }

  private mergeProspectUpdateInput(
    prospect: ProspectEntity,
    patchValues: Record<string, FieldStoredValue>,
    fields: ProspectFieldDefinition[],
  ): Record<string, FieldStoredValue> {
    const knownKeys = new Set(
      getProspectKnownValidationFields(fields).map((field) => field.key),
    );
    knownKeys.add('bantResponses');

    const merged: Record<string, FieldStoredValue> = {};
    for (const [key, value] of Object.entries({
      ...prospect.values,
      ...patchValues,
    })) {
      if (isProspectBantComputedFieldKey(key)) {
        continue;
      }

      if (!knownKeys.has(key)) {
        continue;
      }

      merged[key] = value;
    }

    this.hydrateProspectSystemIdentityValues(fields, merged, {
      fullName: prospect.fullName,
      email: prospect.email,
    });
    return merged;
  }

  private hydrateProspectSystemIdentityValues(
    fields: ProspectFieldDefinition[],
    values: Record<string, FieldStoredValue>,
    fallback: { fullName: string; email: string },
  ): void {
    for (const field of fields) {
      if (!field.system) {
        continue;
      }

      if (!this.isEmptyRawValue(values[field.key], field)) {
        continue;
      }

      if (field.key === 'fullName') {
        try {
          values[field.key] = resolveProspectFullName(fields, values);
        } catch {
          const name = fallback.fullName.trim();
          if (name) {
            values[field.key] = name;
          }
        }
        continue;
      }

      if (field.key === 'email') {
        const resolved = resolveProspectEmail(fields, values);
        values[field.key] = resolved || fallback.email.trim() || null;
      }
    }
  }

  private validateProspectValues(
    fields: ProspectFieldDefinition[],
    input: Record<string, FieldStoredValue>,
    options: { partial: boolean; knownFields?: ProspectFieldDefinition[] },
  ): Record<string, FieldStoredValue> {
    const knownFields = options.knownFields ?? fields;
    const fieldByKey = new Map(knownFields.map((field) => [field.key, field]));
    const values: Record<string, FieldStoredValue> = {};

    for (const field of fields) {
      if (field.type === 'section') {
        continue;
      }

      if (isProspectBantComputedField(field)) {
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

      values[field.key] = this.coerceFieldValue(field, rawValue);
    }

    for (const key of Object.keys(input)) {
      if (key === 'bantResponses') {
        values[key] = input[key];
        continue;
      }

      if (isProspectBantComputedFieldKey(key)) {
        continue;
      }

      if (!fieldByKey.has(key)) {
        throw new BadRequestException(`Unknown field "${key}"`);
      }
    }

    return values;
  }

  private async applyBantComputedFieldsToValues(
    organizationId: string,
    values: Record<string, FieldStoredValue>,
  ): Promise<void> {
    const settings = await this.bantSettingsService.getSettings(organizationId);
    applyProspectBantComputedFieldValues(values, settings.config);
  }

  private async syncProspectBantComputedFieldsForList(
    organizationId: string,
    prospects: ProspectEntity[],
  ): Promise<void> {
    if (prospects.length === 0) {
      return;
    }

    const settings = await this.bantSettingsService.getSettings(organizationId);
    for (const prospect of prospects) {
      applyProspectBantComputedFieldValues(prospect.values, settings.config);
    }
  }

  private async syncProspectBantComputedFields(
    organizationId: string,
    prospect: ProspectEntity,
    options: { persistIfMissing: boolean },
  ): Promise<void> {
    const beforeScore = prospect.values.score;
    const beforeTier = prospect.values.bantTier;

    await this.applyBantComputedFieldsToValues(organizationId, prospect.values);

    const wasMissing =
      beforeScore === undefined ||
      beforeScore === null ||
      beforeTier === undefined ||
      beforeTier === null;

    if (
      options.persistIfMissing &&
      wasMissing &&
      prospect.values.score !== undefined &&
      prospect.values.score !== null
    ) {
      await this.prospectsRepository.saveProspect(prospect);
    }
  }

  private coerceFieldValue(
    field: ProspectFieldDefinition,
    rawValue: FieldStoredValue,
  ): FieldStoredValue {
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
      case 'multiselect': {
        if (!Array.isArray(rawValue)) {
          throw new BadRequestException(`${field.label} must be an array`);
        }

        const values = rawValue
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);

        for (const value of values) {
          const allowed = field.options?.some(
            (option) => option.value === value,
          );
          if (!allowed) {
            throw new BadRequestException(`Invalid value for ${field.label}`);
          }
        }

        return values;
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
    field: ProspectFieldDefinition,
  ): boolean {
    if (rawValue === undefined || rawValue === null) {
      return true;
    }

    if (typeof rawValue === 'string') {
      return rawValue.trim() === '';
    }

    if (Array.isArray(rawValue)) {
      return rawValue.length === 0;
    }

    if (field.type === 'location' && isLocationValue(rawValue)) {
      return isEmptyLocationValue(rawValue);
    }

    return false;
  }

  private extractString(value: FieldStoredValue | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return '';
    }

    return String(value).trim();
  }

  private extractOptionalString(
    value: FieldStoredValue | undefined,
  ): string | null {
    const normalized = this.extractString(value);
    return normalized.length > 0 ? normalized : null;
  }

  private resolveStageLabel(
    stageField: ProspectFieldDefinition | undefined,
    stageValue: string | null,
  ): string {
    if (!stageValue) {
      return 'Unassigned';
    }

    const option = stageField?.options?.find(
      (entry) => entry.value === stageValue,
    );

    return option?.label ?? stageValue;
  }

  private async logStatusChangeEngagement(input: {
    prospectId: string;
    fromStageValue: string | null;
    toStageValue: string | null;
    stageField: ProspectFieldDefinition | undefined;
    createdById: string | null;
  }): Promise<void> {
    const fromLabel = this.resolveStageLabel(
      input.stageField,
      input.fromStageValue,
    );
    const toLabel = this.resolveStageLabel(
      input.stageField,
      input.toStageValue,
    );

    const engagement = this.prospectsRepository.createEngagement({
      prospectId: input.prospectId,
      type: 'status_change',
      discussion: `Status changed from ${fromLabel} to ${toLabel}`,
      outcome: 'neutral',
      nextStep: null,
      fromStageValue: input.fromStageValue,
      toStageValue: input.toStageValue,
      fromStageLabel: fromLabel,
      toStageLabel: toLabel,
      createdById: input.createdById,
    });

    await this.prospectsRepository.saveEngagement(engagement);
  }
}
