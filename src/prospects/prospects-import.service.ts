import { BadRequestException, Injectable } from '@nestjs/common';
import {
  assertRequiredFieldsMapped,
  assertUniqueFieldMappingColumns,
  buildImportableFieldDescriptors,
  getImportDedupKeyFromValues,
  mapCsvRowToRawValues,
} from '../common/crm-import/crm-import-field.utils';
import type {
  CrmImportPreviewResult,
  CrmImportResult,
  CrmImportRowError,
} from '../common/crm-import/crm-import.types';
import { FileParserService } from '../common/file-parser/file-parser.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { FieldStoredValue } from '../common/location/location-field.types';
import { ProspectsRepository } from './prospects.repository';
import { ProspectsService } from './prospects.service';
import {
  PIPELINE_STAGE_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
  type ProspectFieldDefinition,
} from './types/prospect-field-schema';

const BATCH_SIZE = 100;
const MAX_PREVIEW_ISSUES = 100;

interface PreparedProspectRow {
  rowNumber: number;
  fullName: string;
  email: string;
  values: Record<string, FieldStoredValue>;
}

@Injectable()
export class ProspectsImportService {
  constructor(
    private readonly fileParserService: FileParserService,
    private readonly prospectsRepository: ProspectsRepository,
    private readonly prospectsService: ProspectsService,
  ) {}

  async previewImport(
    file: Express.Multer.File,
    organizationId: string | null,
    fieldMapping?: Record<string, string>,
  ): Promise<CrmImportPreviewResult> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const validatedFile =
      this.fileParserService.assertSupportedCrmImportFile(file);
    const parsed = await this.fileParserService.parseFile(validatedFile);
    const schema = await this.prospectsRepository.findSchemaByOrganizationId(
      resolvedOrganizationId,
    );
    const fields = schema?.fields ?? [];
    const importableFields = buildImportableFieldDescriptors(fields);
    const suggestedMapping = this.fileParserService.suggestCrmFieldMapping(
      parsed.columns,
      this.toFieldRefs(fields),
    );

    const result: CrmImportPreviewResult = {
      columns: parsed.columns,
      sampleRows: parsed.rows.slice(0, 5),
      rowCount: parsed.rows.length,
      importableFields,
      suggestedMapping,
    };

    if (fieldMapping && Object.keys(fieldMapping).length > 0) {
      result.rowIssues = await this.validateRows(
        parsed.rows,
        fieldMapping,
        fields,
        resolvedOrganizationId,
        MAX_PREVIEW_ISSUES,
      );
    }

    return result;
  }

  async importRows(
    file: Express.Multer.File,
    fieldMapping: Record<string, string>,
    organizationId: string | null,
  ): Promise<CrmImportResult> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const validatedFile =
      this.fileParserService.assertSupportedCrmImportFile(file);
    const parsed = await this.fileParserService.parseFile(validatedFile);
    const schema = await this.prospectsRepository.findSchemaByOrganizationId(
      resolvedOrganizationId,
    );
    const fields = schema?.fields ?? [];
    const importableFields = buildImportableFieldDescriptors(fields);

    assertUniqueFieldMappingColumns(fieldMapping);
    assertRequiredFieldsMapped(importableFields, fieldMapping);

    const errors = await this.validateRows(
      parsed.rows,
      fieldMapping,
      fields,
      resolvedOrganizationId,
    );

    const errorRows = new Set(errors.map((error) => error.row));
    const preparedRows: PreparedProspectRow[] = [];

    for (let index = 0; index < parsed.rows.length; index += 1) {
      const rowNumber = index + 2;
      if (errorRows.has(rowNumber)) {
        continue;
      }

      const row = parsed.rows[index];
      if (!row) {
        continue;
      }

      try {
        preparedRows.push(
          await this.prepareRow(
            row,
            rowNumber,
            fieldMapping,
            fields,
            resolvedOrganizationId,
          ),
        );
      } catch (error) {
        errors.push(this.toRowError(rowNumber, 'email', error));
      }
    }

    let created = 0;

    for (let index = 0; index < preparedRows.length; index += BATCH_SIZE) {
      const batch = preparedRows.slice(index, index + BATCH_SIZE);
      const entities = batch.map((row) =>
        this.prospectsRepository.createProspect({
          organizationId: resolvedOrganizationId,
          fullName: row.fullName,
          email: row.email,
          values: row.values,
        }),
      );

      await this.prospectsRepository.saveProspects(entities);
      created += entities.length;
    }

    return {
      created,
      failed: errors.length,
      errors,
    };
  }

  private async validateRows(
    rows: Record<string, string>[],
    fieldMapping: Record<string, string>,
    fields: ProspectFieldDefinition[],
    organizationId: string,
    maxIssues?: number,
  ): Promise<CrmImportRowError[]> {
    const errors: CrmImportRowError[] = [];
    const seenEmails = new Set<string>();
    const emailsInFile: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }

      try {
        const rawValues = mapCsvRowToRawValues(row, fieldMapping, fields);
        const dedupKey = getImportDedupKeyFromValues('prospect', rawValues);
        if (dedupKey) {
          emailsInFile.push(dedupKey);
        }
      } catch {
        // Row-level validation below captures detailed errors.
      }
    }

    const existingEmails =
      await this.prospectsRepository.findExistingEmailsByOrganization(
        organizationId,
        emailsInFile,
      );

    for (let index = 0; index < rows.length; index += 1) {
      if (maxIssues !== undefined && errors.length >= maxIssues) {
        break;
      }

      const rowNumber = index + 2;
      const row = rows[index];
      if (!row) {
        continue;
      }

      if (this.isEmptyDataRow(row)) {
        continue;
      }

      try {
        const prepared = await this.prepareRow(
          row,
          rowNumber,
          fieldMapping,
          fields,
          organizationId,
        );

        if (seenEmails.has(prepared.email)) {
          errors.push({
            row: rowNumber,
            key: 'email',
            message: 'Duplicate email in file',
          });
          continue;
        }

        seenEmails.add(prepared.email);

        if (existingEmails.has(prepared.email)) {
          errors.push({
            row: rowNumber,
            key: 'email',
            message: 'Prospect with this email already exists',
          });
        }
      } catch (error) {
        errors.push(this.toRowError(rowNumber, 'email', error));
      }
    }

    return errors;
  }

  private async prepareRow(
    row: Record<string, string>,
    rowNumber: number,
    fieldMapping: Record<string, string>,
    fields: ProspectFieldDefinition[],
    organizationId: string,
  ): Promise<PreparedProspectRow> {
    void rowNumber;

    const rawValues = mapCsvRowToRawValues(row, fieldMapping, fields);

    if (!rawValues[PIPELINE_STAGE_FIELD_KEY]) {
      rawValues[PIPELINE_STAGE_FIELD_KEY] = PROTECTED_PIPELINE_STAGE_VALUE;
    }

    const validated = await this.prospectsService.validateImportValues(
      organizationId,
      rawValues,
    );

    return {
      rowNumber,
      fullName: validated.fullName,
      email: validated.email,
      values: validated.values,
    };
  }

  private isEmptyDataRow(row: Record<string, string>): boolean {
    return Object.values(row).every((value) => value.trim().length === 0);
  }

  private toFieldRefs(fields: ProspectFieldDefinition[]) {
    return fields
      .filter((field) => field.type !== 'section')
      .flatMap((field) => {
        if (field.type === 'location') {
          return (field.locationComponents ?? []).map((component) => ({
            key: `${field.key}.${component}`,
            label: `${field.label} (${component})`,
            type: field.type,
            locationComponents: field.locationComponents,
          }));
        }

        return [
          {
            key: field.key,
            label: field.label,
            type: field.type,
            locationComponents: field.locationComponents,
          },
        ];
      });
  }

  private toRowError(
    row: number,
    key: string,
    error: unknown,
  ): CrmImportRowError {
    if (error instanceof BadRequestException) {
      const response = error.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : typeof response === 'object' &&
              response !== null &&
              'message' in response
            ? String((response as { message: string | string[] }).message)
            : 'Invalid row';

      return {
        row,
        key,
        message: Array.isArray(message) ? message.join(', ') : message,
      };
    }

    return {
      row,
      key,
      message: 'Invalid row',
    };
  }
}
