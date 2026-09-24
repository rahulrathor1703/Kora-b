import { Injectable } from '@nestjs/common';
import { ProspectsRepository } from './prospects.repository';
import type {
  ContactListMemberForSync,
  ManualListColumnForSync,
  ProspectFieldMapping,
  ProspectImportRow,
  ProspectSyncResult,
} from './types/list-prospect-sync.types';
import type { ProspectFieldDefinition } from './types/prospect-field-schema';
import {
  PIPELINE_STAGE_FIELD_KEY,
  PROTECTED_PIPELINE_STAGE_VALUE,
} from './types/prospect-field-schema';
import { ProspectEntity } from './entities/prospect.entity';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BATCH_SIZE = 100;

const EMAIL_COLUMN_ALIASES = new Set([
  'email',
  'e mail',
  'email address',
  'mail',
]);

const NAME_COLUMN_ALIASES = new Set([
  'name',
  'full name',
  'fullname',
  'contact name',
  'first name',
  'firstname',
]);

@Injectable()
export class ListProspectSyncService {
  constructor(private readonly prospectsRepository: ProspectsRepository) {}

  async syncRows(
    organizationId: string,
    rows: ProspectImportRow[],
  ): Promise<ProspectSyncResult> {
    const schema =
      await this.prospectsRepository.findSchemaByOrganizationId(organizationId);

    const fields = schema?.fields ?? [];
    const schemaKeys = new Set(fields.map((field) => field.key));

    const normalizedRows = rows
      .map((row) => this.normalizeImportRow(row, fields, schemaKeys))
      .filter((row): row is NormalizedProspectRow => row !== null);

    if (normalizedRows.length === 0) {
      return { created: 0, skipped: 0, failed: rows.length };
    }

    const uniqueRows = this.deduplicateByEmail(normalizedRows);
    const skippedInInput = normalizedRows.length - uniqueRows.length;

    const existingEmails =
      await this.prospectsRepository.findExistingEmailsByOrganization(
        organizationId,
        uniqueRows.map((row) => row.email),
      );

    const rowsToCreate = uniqueRows.filter(
      (row) => !existingEmails.has(row.email),
    );
    const skippedExisting = uniqueRows.length - rowsToCreate.length;

    let created = 0;

    for (let index = 0; index < rowsToCreate.length; index += BATCH_SIZE) {
      const batch = rowsToCreate.slice(index, index + BATCH_SIZE);
      const entities = batch.map((row) =>
        this.prospectsRepository.createProspect({
          organizationId,
          fullName: row.fullName,
          email: row.email,
          values: row.values,
        }),
      );

      await this.prospectsRepository.saveProspects(entities);
      created += entities.length;
    }

    const failed = rows.length - normalizedRows.length + skippedInInput;

    return {
      created,
      skipped: skippedExisting + skippedInInput,
      failed,
    };
  }

  mapContactListMembers(
    members: ContactListMemberForSync[],
  ): ProspectImportRow[] {
    return members.map((member) => ({
      email: member.email,
      fullName: this.buildFullName(
        member.firstName,
        member.lastName,
        member.email,
      ),
      phone: member.phone ?? undefined,
      designation: member.company ?? undefined,
    }));
  }

  mapManualListRows(
    columns: ManualListColumnForSync[],
    rows: Array<Record<string, string>>,
    mapping?: ProspectFieldMapping,
  ): ProspectImportRow[] {
    const resolvedMapping =
      mapping ?? this.detectManualListFieldMapping(columns);

    if (!resolvedMapping) {
      return [];
    }

    const mappedRows: ProspectImportRow[] = [];

    for (const row of rows) {
      const email = (row[resolvedMapping.emailColumnKey] ?? '')
        .trim()
        .toLowerCase();
      if (!email) {
        continue;
      }

      const nameColumnKey = resolvedMapping.nameColumnKey;
      const fullName = nameColumnKey
        ? (row[nameColumnKey] ?? '').trim() ||
          this.buildFullName(null, null, email)
        : this.buildFullName(null, null, email);

      mappedRows.push({ email, fullName });
    }

    return mappedRows;
  }

  detectManualListFieldMapping(
    columns: ManualListColumnForSync[],
  ): ProspectFieldMapping | null {
    let emailColumnKey: string | null = null;
    let nameColumnKey: string | undefined;

    for (const column of columns) {
      const normalized = this.normalizeColumnLabel(column.label, column.key);

      if (!emailColumnKey && EMAIL_COLUMN_ALIASES.has(normalized)) {
        emailColumnKey = column.key;
      }

      if (!nameColumnKey && NAME_COLUMN_ALIASES.has(normalized)) {
        nameColumnKey = column.key;
      }
    }

    if (!emailColumnKey) {
      return null;
    }

    return { emailColumnKey, nameColumnKey };
  }

  private normalizeImportRow(
    row: ProspectImportRow,
    fields: ProspectFieldDefinition[],
    schemaKeys: Set<string>,
  ): NormalizedProspectRow | null {
    const email = row.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) {
      return null;
    }

    const fullName =
      row.fullName?.trim() || this.buildFullName(null, null, email);

    const values: Record<string, string | null> = {
      fullName,
      email,
      [PIPELINE_STAGE_FIELD_KEY]: PROTECTED_PIPELINE_STAGE_VALUE,
    };

    if (row.phone?.trim() && schemaKeys.has('phone')) {
      values.phone = row.phone.trim();
    }

    if (row.designation?.trim() && schemaKeys.has('designation')) {
      values.designation = row.designation.trim();
    }

    for (const field of fields) {
      if (field.type === 'section') {
        continue;
      }

      const value = values[field.key];
      if (value === undefined) {
        values[field.key] = field.required ? null : null;
      }
    }

    if (!fullName) {
      return null;
    }

    return {
      email,
      fullName,
      values: values,
    };
  }

  private deduplicateByEmail(
    rows: NormalizedProspectRow[],
  ): NormalizedProspectRow[] {
    const seen = new Set<string>();
    const deduped: NormalizedProspectRow[] = [];

    for (const row of rows) {
      if (seen.has(row.email)) {
        continue;
      }

      seen.add(row.email);
      deduped.push(row);
    }

    return deduped;
  }

  private buildFullName(
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    email: string,
  ): string {
    const combined = [firstName?.trim(), lastName?.trim()]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (combined) {
      return combined;
    }

    const localPart = email.split('@')[0]?.trim();
    return localPart || email;
  }

  private normalizeColumnLabel(label: string, key: string): string {
    const source = label.trim() || key.trim();
    return source.toLowerCase().replace(/[\s_-]+/g, ' ');
  }
}

interface NormalizedProspectRow {
  email: string;
  fullName: string;
  values: ProspectEntity['values'];
}
