import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditLogResourceLabelRepository {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findProspectLabel(
    id: string,
    organizationId: string | null,
  ): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT full_name, email
       FROM prospects
       WHERE id = $1
         AND ($2::uuid IS NULL OR organization_id = $2::uuid)
       LIMIT 1`,
      [id, organizationId],
      (row: { full_name: string; email: string }) =>
        row.full_name?.trim() || row.email?.trim() || null,
    );
  }

  findCompanyLabel(
    id: string,
    organizationId: string | null,
  ): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT broker_name
       FROM companies
       WHERE id = $1
         AND ($2::uuid IS NULL OR organization_id = $2::uuid)
       LIMIT 1`,
      [id, organizationId],
      (row: { broker_name: string }) => row.broker_name?.trim() ?? null,
    );
  }

  findRoleLabel(id: string): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT name FROM roles WHERE id = $1 LIMIT 1`,
      [id],
      (row: { name: string }) => row.name?.trim() ?? null,
    );
  }

  findMailboxLabel(
    id: string,
    organizationId: string | null,
  ): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT email, name
       FROM mailboxes
       WHERE id = $1
         AND ($2::uuid IS NULL OR organization_id = $2::uuid)
       LIMIT 1`,
      [id, organizationId],
      (row: { email: string; name: string | null }) =>
        row.name?.trim() || row.email?.trim() || null,
    );
  }

  findMeetingLabel(
    id: string,
    organizationId: string | null,
  ): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT meetings.title, prospects.full_name, prospects.email
       FROM meetings
       LEFT JOIN prospects ON prospects.id = meetings.prospect_id
       WHERE meetings.id = $1
         AND ($2::uuid IS NULL OR meetings.organization_id = $2::uuid)
       LIMIT 1`,
      [id, organizationId],
      (row: {
        title: string | null;
        full_name: string | null;
        email: string | null;
      }) =>
        row.title?.trim() || row.full_name?.trim() || row.email?.trim() || null,
    );
  }

  findUserLabel(id: string): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT username, email FROM users WHERE id = $1 LIMIT 1`,
      [id],
      (row: { username: string | null; email: string }) =>
        row.username?.trim() || row.email?.trim() || null,
    );
  }

  findNamedRowLabel(
    tableName:
      | 'contact_lists'
      | 'manual_lists'
      | 'email_templates'
      | 'email_campaigns'
      | 'company_config_options'
      | 'email_config_options'
      | 'abac_policies'
      | 'invitations',
    id: string,
    organizationId: string | null,
    column: 'name' | 'label' | 'email',
  ): Promise<string | null> {
    return this.querySingleLabel(
      `SELECT ${column} AS value
       FROM ${tableName}
       WHERE id = $1
         AND ($2::uuid IS NULL OR organization_id = $2::uuid)
       LIMIT 1`,
      [id, organizationId],
      (row: { value: string }) =>
        typeof row.value === 'string' && row.value.trim()
          ? row.value.trim()
          : null,
    );
  }

  private async querySingleLabel<TRow>(
    sql: string,
    params: unknown[],
    mapRow: (row: TRow) => string | null,
  ): Promise<string | null> {
    const rows = await this.dataSource.query<TRow[]>(sql, params);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapRow(row);
  }
}
