import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { FormSchemaEntity } from './entities/form-schema.entity';
import { FormsRepository } from './forms.repository';
import {
  getFormRegistryEntry,
  listFormRegistryEntries,
  requireFormRegistryEntry,
} from './registry/form-registry';
import type { UpdateFormSchemaDto } from './dto/update-form-schema.dto';
import type {
  FormFieldDefinition,
  FormRegistryListItem,
  FormRegistryListResponse,
  FormSchemaPayload,
  FormTableColumnDefinition,
  ResolvedFormSchemaResponse,
} from './types/form-schema.types';
import { validateFormFieldSchema } from './validation/field-schema.validator';
import { validateFormTableColumnSchema } from './validation/table-column-schema.validator';

@Injectable()
export class FormsService {
  constructor(private readonly formsRepository: FormsRepository) {}

  async listRegistryForOrg(
    organizationId: string | null,
  ): Promise<FormRegistryListResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    return this.buildRegistryList(resolvedOrganizationId);
  }

  async listRegistryForPlatform(): Promise<FormRegistryListResponse> {
    return this.buildRegistryList(null);
  }

  async getResolvedSchema(
    formKey: string,
    organizationId: string | null,
  ): Promise<ResolvedFormSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    requireFormRegistryEntry(formKey);
    return this.resolveSchema(formKey, resolvedOrganizationId);
  }

  async getPlatformSchema(
    formKey: string,
  ): Promise<ResolvedFormSchemaResponse> {
    requireFormRegistryEntry(formKey);
    const platformSchema = await this.ensurePlatformSchema(formKey);
    return this.toResponse(formKey, platformSchema, 'platform');
  }

  async updatePlatformSchema(
    formKey: string,
    dto: UpdateFormSchemaDto,
  ): Promise<ResolvedFormSchemaResponse> {
    const registryEntry = requireFormRegistryEntry(formKey);
    const validatedFields = validateFormFieldSchema(dto.fields);
    const existing = await this.ensurePlatformSchema(formKey);

    existing.fields = validatedFields;
    if (dto.tableColumns !== undefined) {
      existing.tableColumns = validateFormTableColumnSchema(dto.tableColumns, {
        requireEmailColumn: formKey === 'email.list.contact.import',
      });
    } else if (
      registryEntry.supportsTableColumns &&
      existing.tableColumns.length === 0
    ) {
      existing.tableColumns = registryEntry.defaultSchema.tableColumns ?? [];
    }
    existing.steps = dto.steps ?? existing.steps;
    existing.layout = dto.layout ?? existing.layout;
    existing.version = (dto.version ?? existing.version) + 1;

    const saved = await this.formsRepository.saveSchema(existing);
    return this.toResponse(formKey, saved, 'platform');
  }

  async updateOrgExtensions(
    formKey: string,
    dto: UpdateFormSchemaDto,
    organizationId: string | null,
  ): Promise<ResolvedFormSchemaResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const registryEntry = requireFormRegistryEntry(formKey);

    if (!registryEntry.supportsOrgExtensions) {
      throw new BadRequestException(
        `Form "${formKey}" does not support organization extensions`,
      );
    }

    const platformSchema = await this.ensurePlatformSchema(formKey);
    const orgFields = this.extractOrgExtensionFields(
      dto.fields,
      platformSchema.fields,
    );
    const validatedOrgFields = validateFormFieldSchema(orgFields);

    let orgTableColumnsUpdate: FormTableColumnDefinition[] | undefined;
    if (registryEntry.supportsTableColumns && dto.tableColumns !== undefined) {
      const orgTableColumns = this.extractOrgExtensionTableColumns(
        dto.tableColumns,
        platformSchema.tableColumns ?? [],
      );
      orgTableColumnsUpdate = validateFormTableColumnSchema(orgTableColumns, {
        requireEmailColumn: false,
      });
    }

    let orgExtension = await this.formsRepository.findOrgExtension(
      formKey,
      resolvedOrganizationId,
    );

    if (!orgExtension) {
      orgExtension = this.formsRepository.createSchema(
        formKey,
        resolvedOrganizationId,
        {
          fields: validatedOrgFields,
          tableColumns: orgTableColumnsUpdate ?? [],
          steps: null,
          layout: null,
        },
      );
    } else {
      orgExtension.fields = validatedOrgFields;
      if (orgTableColumnsUpdate !== undefined) {
        orgExtension.tableColumns = orgTableColumnsUpdate;
      }
      orgExtension.version = (dto.version ?? orgExtension.version) + 1;
    }

    await this.formsRepository.saveSchema(orgExtension);
    return this.resolveSchema(formKey, resolvedOrganizationId);
  }

  async resolveSchema(
    formKey: string,
    organizationId: string,
  ): Promise<ResolvedFormSchemaResponse> {
    const registryEntry = requireFormRegistryEntry(formKey);
    const platformSchema = await this.ensurePlatformSchema(formKey);
    const orgExtension = registryEntry.supportsOrgExtensions
      ? await this.formsRepository.findOrgExtension(formKey, organizationId)
      : null;

    const orgExtensionByKey = new Map(
      (orgExtension?.fields ?? []).map((field) => [field.key, field]),
    );

    const platformFields = platformSchema.fields.map((field) =>
      this.mergeFieldWithOrgOverride(field, orgExtensionByKey.get(field.key)),
    );

    const orgOnlyFields = (orgExtension?.fields ?? [])
      .filter(
        (field) => !platformSchema.fields.some((p) => p.key === field.key),
      )
      .map((field) => ({
        ...field,
        source: 'org' as const,
      }));

    const mergedFields = [...platformFields, ...orgOnlyFields].map(
      (field, index) => ({
        ...field,
        sortOrder: index,
      }),
    );

    const mergedTableColumns = this.mergeTableColumns(
      platformSchema.tableColumns ?? [],
      orgExtension?.tableColumns ?? [],
    );

    return {
      formKey,
      fields: mergedFields,
      tableColumns: mergedTableColumns,
      steps: platformSchema.steps,
      layout: platformSchema.layout,
      version: Math.max(platformSchema.version, orgExtension?.version ?? 0),
    };
  }

  async resolveSchemaFields(
    formKey: string,
    organizationId: string,
  ): Promise<FormFieldDefinition[]> {
    const resolved = await this.resolveSchema(formKey, organizationId);
    return resolved.fields;
  }

  async resolveTableColumns(
    formKey: string,
    organizationId: string,
  ): Promise<FormTableColumnDefinition[]> {
    const resolved = await this.resolveSchema(formKey, organizationId);
    return resolved.tableColumns ?? [];
  }

  private async ensurePlatformSchema(
    formKey: string,
  ): Promise<FormSchemaEntity> {
    const existing = await this.formsRepository.findPlatformSchema(formKey);
    if (existing) {
      return existing;
    }

    const registryEntry = requireFormRegistryEntry(formKey);
    const created = this.formsRepository.createSchema(formKey, null, {
      ...registryEntry.defaultSchema,
      tableColumns: registryEntry.defaultSchema.tableColumns ?? [],
      version: 1,
    });
    return this.formsRepository.saveSchema(created);
  }

  private extractOrgExtensionFields(
    submittedFields: FormFieldDefinition[],
    platformFields: FormFieldDefinition[],
  ): FormFieldDefinition[] {
    const platformKeys = new Set(platformFields.map((field) => field.key));
    const platformByKey = new Map(
      platformFields.map((field) => [field.key, field]),
    );
    const orgFields: FormFieldDefinition[] = [];

    for (const field of submittedFields) {
      if (!platformKeys.has(field.key)) {
        orgFields.push(field);
        continue;
      }

      const platformField = platformByKey.get(field.key)!;

      if (this.isOptionsOnlyExtension(field, platformField)) {
        orgFields.push({
          ...platformField,
          options: field.options,
        });
        continue;
      }

      const changed =
        field.label !== platformField.label ||
        field.type !== platformField.type ||
        field.required !== platformField.required ||
        field.sortOrder !== platformField.sortOrder ||
        field.showInTable !== platformField.showInTable ||
        field.showInForm !== platformField.showInForm ||
        field.filterable !== platformField.filterable ||
        field.formColSpan !== platformField.formColSpan;

      if (changed) {
        throw new BadRequestException(
          `Platform field "${field.key}" cannot be modified by organization`,
        );
      }
    }

    const deletedPlatformKeys = platformFields.filter(
      (platformField) =>
        !submittedFields.some((field) => field.key === platformField.key),
    );

    if (deletedPlatformKeys.length > 0) {
      throw new BadRequestException(
        `Platform fields cannot be removed: ${deletedPlatformKeys.map((f) => f.key).join(', ')}`,
      );
    }

    return orgFields;
  }

  private extractOrgExtensionTableColumns(
    submittedColumns: FormTableColumnDefinition[],
    platformColumns: FormTableColumnDefinition[],
  ): FormTableColumnDefinition[] {
    const platformKeys = new Set(platformColumns.map((column) => column.key));
    const platformByKey = new Map(
      platformColumns.map((column) => [column.key, column]),
    );
    const orgColumns: FormTableColumnDefinition[] = [];

    for (const column of submittedColumns) {
      if (!platformKeys.has(column.key)) {
        orgColumns.push(column);
        continue;
      }

      const platformColumn = platformByKey.get(column.key)!;

      if (platformColumn.system) {
        if (
          column.label !== platformColumn.label ||
          column.type !== platformColumn.type ||
          column.required !== platformColumn.required ||
          column.system !== platformColumn.system
        ) {
          throw new BadRequestException(
            `System table column "${column.key}" cannot be modified by organization`,
          );
        }
        continue;
      }

      const changed =
        column.label !== platformColumn.label ||
        column.type !== platformColumn.type ||
        column.required !== platformColumn.required ||
        column.sortOrder !== platformColumn.sortOrder;

      if (changed) {
        throw new BadRequestException(
          `Platform table column "${column.key}" cannot be modified by organization`,
        );
      }
    }

    const deletedPlatformColumns = platformColumns.filter(
      (platformColumn) =>
        !submittedColumns.some((column) => column.key === platformColumn.key),
    );

    if (deletedPlatformColumns.length > 0) {
      throw new BadRequestException(
        `Platform table columns cannot be removed: ${deletedPlatformColumns.map((column) => column.key).join(', ')}`,
      );
    }

    return orgColumns;
  }

  private mergeTableColumns(
    platformColumns: FormTableColumnDefinition[],
    orgColumns: FormTableColumnDefinition[],
  ): FormTableColumnDefinition[] {
    const orgByKey = new Map(orgColumns.map((column) => [column.key, column]));

    const mergedPlatform = platformColumns.map((column) => ({
      ...column,
      source: 'platform' as const,
    }));

    const orgOnly = orgColumns
      .filter(
        (column) =>
          !platformColumns.some((platform) => platform.key === column.key),
      )
      .map((column) => ({
        ...column,
        source: 'org' as const,
      }));

    return [...mergedPlatform, ...orgOnly]
      .map((column) => {
        const orgOverride = orgByKey.get(column.key);
        if (orgOverride && column.source === 'platform' && !column.system) {
          return { ...column, ...orgOverride, source: 'platform' as const };
        }
        return column;
      })
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((column, index) => ({
        ...column,
        sortOrder: index,
      }));
  }

  private isOptionsOnlyExtension(
    submitted: FormFieldDefinition,
    platform: FormFieldDefinition,
  ): boolean {
    if (
      !platform.pipelineStage &&
      submitted.type !== 'select' &&
      submitted.type !== 'multiselect'
    ) {
      return false;
    }

    if (platform.pipelineStage || platform.filterable) {
      const structuralMatch =
        submitted.label === platform.label &&
        submitted.type === platform.type &&
        submitted.required === platform.required;

      if (structuralMatch && submitted.options) {
        return true;
      }
    }

    return false;
  }

  private mergeFieldWithOrgOverride(
    platformField: FormFieldDefinition,
    orgOverride: FormFieldDefinition | undefined,
  ): FormFieldDefinition {
    if (!orgOverride) {
      return { ...platformField, source: 'platform' as const };
    }

    if (
      orgOverride.options &&
      (platformField.pipelineStage || platformField.filterable)
    ) {
      return {
        ...platformField,
        options: orgOverride.options,
        source: 'platform' as const,
      };
    }

    return { ...platformField, source: 'platform' as const };
  }

  private async buildRegistryList(
    organizationId: string | null,
  ): Promise<FormRegistryListResponse> {
    const platformSchemas = await this.formsRepository.findAllPlatformSchemas();
    const platformKeys = new Set(
      platformSchemas.map((schema) => schema.formKey),
    );

    const orgExtensions =
      organizationId === null
        ? []
        : await this.formsRepository.findAllOrgExtensions(organizationId);
    const orgExtensionKeys = new Set(
      orgExtensions.map((schema) => schema.formKey),
    );

    const forms: FormRegistryListItem[] = listFormRegistryEntries().map(
      (entry) => ({
        key: entry.key,
        module: entry.module,
        label: entry.label,
        formType: entry.formType,
        supportsOrgExtensions: entry.supportsOrgExtensions,
        supportsTableColumns: entry.supportsTableColumns,
        customWidgets: entry.customWidgets,
        hasPlatformSchema: platformKeys.has(entry.key),
        hasOrgExtensions: orgExtensionKeys.has(entry.key),
      }),
    );

    return { forms };
  }

  private toResponse(
    formKey: string,
    entity: {
      fields: FormFieldDefinition[];
      tableColumns?: FormTableColumnDefinition[];
      steps: FormSchemaPayload['steps'];
      layout: FormSchemaPayload['layout'];
      version: number;
    },
    source: 'platform' | 'org',
  ): ResolvedFormSchemaResponse {
    return {
      formKey,
      fields: entity.fields.map((field) => ({ ...field, source })),
      tableColumns: (entity.tableColumns ?? []).map((column) => ({
        ...column,
        source,
      })),
      steps: entity.steps,
      layout: entity.layout,
      version: entity.version,
    };
  }

  assertFormKeyExists(formKey: string): void {
    if (!getFormRegistryEntry(formKey)) {
      throw new NotFoundException(`Unknown form key: ${formKey}`);
    }
  }
}
