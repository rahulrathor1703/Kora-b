import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { AbacPolicyEntity } from '../src/abac/entities/abac-policy.entity';
import { UserAbacPolicyEntity } from '../src/abac/entities/user-abac-policy.entity';
import { InvitationEntity } from '../src/invitations/entities/invitation.entity';
import { Organization } from '../src/organizations/entities/organization.entity';
import { slugifyOrganizationName } from '../src/organizations/organization-slug.util';
import { PermissionEntity } from '../src/rbac/entities/permission.entity';
import { RolePermissionEntity } from '../src/rbac/entities/role-permission.entity';
import { RoleEntity } from '../src/rbac/entities/role.entity';
import { UserRoleEntity } from '../src/rbac/entities/user-role.entity';
import { SignupSession } from '../src/signup/entities/signup-session.entity';
import { TableColumnDefaultEntity } from '../src/table-preferences/entities/table-column-default.entity';
import { UserTableColumnPreferenceEntity } from '../src/table-preferences/entities/user-table-column-preference.entity';
import { User } from '../src/users/entities/user.entity';
import { ensureLocalDatabase, LOCAL_DB } from './local-db';

async function columnExists(
  client: Client,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
    ) AS exists`,
    [tableName, columnName],
  );

  return result.rows[0]?.exists ?? false;
}

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
    ) AS exists`,
    [tableName],
  );

  return result.rows[0]?.exists ?? false;
}

async function backfillOrganizationSlugs(client: Client): Promise<void> {
  if (!(await tableExists(client, 'organizations'))) {
    return;
  }

  if (!(await columnExists(client, 'organizations', 'slug'))) {
    await client.query(`ALTER TABLE organizations ADD COLUMN slug varchar(64)`);
  }

  const { rows } = await client.query<{
    id: string;
    name: string;
    slug: string | null;
  }>(
    `SELECT id, name, slug
     FROM organizations
     WHERE slug IS NULL OR slug = ''`,
  );

  if (rows.length === 0) {
    return;
  }

  const usedSlugs = new Set<string>();
  const existing = await client.query<{ slug: string }>(
    `SELECT slug
     FROM organizations
     WHERE slug IS NOT NULL
       AND slug <> ''`,
  );

  for (const row of existing.rows) {
    usedSlugs.add(row.slug);
  }

  for (const org of rows) {
    let baseSlug = slugifyOrganizationName(org.name);

    if (baseSlug.length < 3) {
      baseSlug = `org-${org.id.slice(0, 8)}`;
    }

    let candidate = baseSlug;
    let suffix = 2;

    while (usedSlugs.has(candidate)) {
      candidate = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    usedSlugs.add(candidate);

    await client.query(`UPDATE organizations SET slug = $1 WHERE id = $2`, [
      candidate,
      org.id,
    ]);
  }

  console.log(`Backfilled organization slugs for ${rows.length} row(s)`);
}

async function prepareLegacySchema(client: Client): Promise<void> {
  if (!(await tableExists(client, 'organizations'))) {
    return;
  }

  await backfillOrganizationSlugs(client);

  if (await columnExists(client, 'organizations', 'slug')) {
    await client.query(
      `ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL`,
    );
  }

  if (!(await columnExists(client, 'organizations', 'status'))) {
    await client.query(
      `ALTER TABLE organizations
       ADD COLUMN status varchar(16) NOT NULL DEFAULT 'active'`,
    );
  }
}

async function syncDatabase(): Promise<void> {
  await ensureLocalDatabase();

  const databaseUrl = process.env.DATABASE_URL ?? LOCAL_DB.url;
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await prepareLegacySchema(client);
  } finally {
    await client.end();
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [
      User,
      Organization,
      SignupSession,
      PermissionEntity,
      RoleEntity,
      RolePermissionEntity,
      UserRoleEntity,
      AbacPolicyEntity,
      UserAbacPolicyEntity,
      InvitationEntity,
      UserTableColumnPreferenceEntity,
      TableColumnDefaultEntity,
    ],
    synchronize: true,
  });

  await dataSource.initialize();
  await dataSource.synchronize();
  await dataSource.destroy();

  const verifyClient = new Client({ connectionString: databaseUrl });
  await verifyClient.connect();

  try {
    const tables = await verifyClient.query<{ tablename: string }>(
      `SELECT tablename
       FROM pg_tables
       WHERE schemaname = 'public'
       ORDER BY tablename`,
    );

    console.log(
      `Database schema synced. Tables: ${tables.rows.map((row) => row.tablename).join(', ')}`,
    );
  } finally {
    await verifyClient.end();
  }
}

void syncDatabase().catch((error: unknown) => {
  console.error('Database sync failed:', error);
  process.exit(1);
});
