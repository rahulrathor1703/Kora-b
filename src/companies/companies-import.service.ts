import { BadRequestException, Injectable } from '@nestjs/common';
import { CompanyConfigRepository } from '../company-config/company-config.repository';
import {
  assertRequiredFieldsMapped,
  assertUniqueFieldMappingColumns,
  buildImportableFieldDescriptors,
  getImportDedupKeyFromValues,
  mapCsvRowToRawValues,
} from '../common/crm-import/crm-import-field.utils';
import type {
  CrmImportDuplicateMode,
  CrmImportPreviewResult,
  CrmImportResult,
  CrmImportRowError,
} from '../common/crm-import/crm-import.types';
import { FileParserService } from '../common/file-parser/file-parser.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { FieldStoredValue } from '../common/location/location-field.types';
import { CompaniesRepository } from './companies.repository';
import { CompaniesService } from './companies.service';
import {
  BROKER_NAME_FIELD_KEY,
  type CompanyFieldDefinition,
} from './types/company-field-schema';

const BATCH_SIZE = 100;
const MAX_PREVIEW_ISSUES = 100;

interface PreparedCompanyRow {
  rowNumber: number;
  brokerName: string;
  values: Record<string, FieldStoredValue>;
}

@Injectable()
export class CompaniesImportService {
  constructor(
    private readonly fileParserService: FileParserService,
    private readonly companiesRepository: CompaniesRepository,
    private readonly companiesService: CompaniesService,
    private readonly companyConfigRepository: CompanyConfigRepository,
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
    const schema = await this.companiesService.getFieldSchema(
      resolvedOrganizationId,
    );
    const fields = schema.fields;
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
    return this.importMappedRows(
      parsed.rows,
      fieldMapping,
      resolvedOrganizationId,
    );
  }

  async importMappedRows(
    rows: Record<string, string>[],
    fieldMapping: Record<string, string>,
    organizationId: string,
    options?: { onDuplicate?: CrmImportDuplicateMode },
  ): Promise<CrmImportResult> {
    const schema = await this.companiesService.getFieldSchema(organizationId);
    const fields = schema.fields;
    const importableFields = buildImportableFieldDescriptors(fields);

    assertUniqueFieldMappingColumns(fieldMapping);
    assertRequiredFieldsMapped(importableFields, fieldMapping);

    const skippedRowNumbers = new Set<number>();
    const errors = await this.validateRows(
      rows,
      fieldMapping,
      fields,
      organizationId,
      undefined,
      {
        onDuplicate: options?.onDuplicate ?? 'fail',
        skippedRowNumbers,
      },
    );

    const errorRows = new Set(errors.map((error) => error.row));
    const preparedRows: PreparedCompanyRow[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      if (errorRows.has(rowNumber) || skippedRowNumbers.has(rowNumber)) {
        continue;
      }

      const row = rows[index];
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
            organizationId,
          ),
        );
      } catch (error) {
        errors.push(this.toRowError(rowNumber, BROKER_NAME_FIELD_KEY, error));
      }
    }

    let created = 0;

    for (let index = 0; index < preparedRows.length; index += BATCH_SIZE) {
      const batch = preparedRows.slice(index, index + BATCH_SIZE);
      const entities = batch.map((row) =>
        this.companiesRepository.create({
          organizationId,
          brokerName: row.brokerName,
          values: row.values,
        }),
      );

      await this.companiesRepository.saveMany(entities);
      created += entities.length;
    }

    return {
      created,
      failed: errors.length,
      skipped: skippedRowNumbers.size,
      errors,
    };
  }

  private async validateRows(
    rows: Record<string, string>[],
    fieldMapping: Record<string, string>,
    fields: CompanyFieldDefinition[],
    organizationId: string,
    maxIssues?: number,
    options?: {
      onDuplicate?: CrmImportDuplicateMode;
      skippedRowNumbers?: Set<number>;
    },
  ): Promise<CrmImportRowError[]> {
    const errors: CrmImportRowError[] = [];
    const seenBrokerNames = new Set<string>();
    const brokerNamesInFile: string[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      if (!row) {
        continue;
      }

      try {
        const rawValues = mapCsvRowToRawValues(
          row,
          fieldMapping,
          fields,
          await this.loadConfigOptions(organizationId),
        );
        const brokerColumn = fieldMapping[BROKER_NAME_FIELD_KEY]?.trim();
        const brokerName = brokerColumn
          ? (row[brokerColumn] ?? '').trim()
          : this.readBrokerNameFromValues(rawValues);
        const dedupKey = getImportDedupKeyFromValues(
          'company',
          rawValues,
          brokerName,
        );
        if (dedupKey) {
          brokerNamesInFile.push(dedupKey);
        }
      } catch {
        // Row-level validation below captures detailed errors.
      }
    }

    const existingBrokerNames =
      await this.companiesRepository.findExistingBrokerNamesByOrganization(
        organizationId,
        brokerNamesInFile,
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

        const normalizedBrokerName = prepared.brokerName.toLowerCase();

        if (seenBrokerNames.has(normalizedBrokerName)) {
          if (options?.onDuplicate === 'skip') {
            options.skippedRowNumbers?.add(rowNumber);
            continue;
          }

          errors.push({
            row: rowNumber,
            key: BROKER_NAME_FIELD_KEY,
            message: 'Duplicate broker name in file',
          });
          continue;
        }

        seenBrokerNames.add(normalizedBrokerName);

        if (existingBrokerNames.has(normalizedBrokerName)) {
          if (options?.onDuplicate === 'skip') {
            options.skippedRowNumbers?.add(rowNumber);
            continue;
          }

          errors.push({
            row: rowNumber,
            key: BROKER_NAME_FIELD_KEY,
            message: 'Company with this broker name already exists',
          });
        }
      } catch (error) {
        errors.push(this.toRowError(rowNumber, BROKER_NAME_FIELD_KEY, error));
      }
    }

    return errors;
  }

  private async prepareRow(
    row: Record<string, string>,
    rowNumber: number,
    fieldMapping: Record<string, string>,
    fields: CompanyFieldDefinition[],
    organizationId: string,
  ): Promise<PreparedCompanyRow> {
    const configOptions = await this.loadConfigOptions(organizationId);
    const rawValues = mapCsvRowToRawValues(
      row,
      fieldMapping,
      fields,
      configOptions,
    );

    const brokerColumn = fieldMapping[BROKER_NAME_FIELD_KEY]?.trim();
    const brokerName = brokerColumn
      ? (row[brokerColumn] ?? '').trim()
      : this.readBrokerNameFromValues(rawValues);

    const valueInput = Object.fromEntries(
      Object.entries(rawValues).filter(
        ([key]) => key !== BROKER_NAME_FIELD_KEY,
      ),
    ) as Record<string, FieldStoredValue>;

    const validated = await this.companiesService.validateImportValues(
      organizationId,
      brokerName,
      valueInput,
    );

    return {
      rowNumber,
      brokerName: validated.brokerName,
      values: validated.values,
    };
  }

  private async loadConfigOptions(organizationId: string) {
    const [categories, locations] = await Promise.all([
      this.companyConfigRepository.findAllByOrganizationId(
        organizationId,
        'category',
      ),
      this.companyConfigRepository.findAllByOrganizationId(
        organizationId,
        'location',
      ),
    ]);

    return {
      categories: categories
        .filter((option) => option.isActive)
        .map((option) => ({
          id: option.id,
          label: option.label,
        })),
      locations: locations
        .filter((option) => option.isActive)
        .map((option) => ({
          id: option.id,
          label: option.label,
        })),
    };
  }

  private readBrokerNameFromValues(
    rawValues: Record<string, FieldStoredValue>,
  ): string {
    const brokerValue = rawValues[BROKER_NAME_FIELD_KEY];
    return typeof brokerValue === 'string' ? brokerValue.trim() : '';
  }

  private isEmptyDataRow(row: Record<string, string>): boolean {
    return Object.values(row).every((value) => value.trim().length === 0);
  }

  private toFieldRefs(fields: CompanyFieldDefinition[]) {
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
