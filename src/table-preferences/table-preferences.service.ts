import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { hasPermission } from '../auth/auth-access.utils';
import { AuthUser } from '../auth/auth.types';
import { UpsertTablePreferencesDto } from './dto/upsert-table-preferences.dto';
import { TableColumnDefaultsRepository } from './table-column-defaults.repository';
import type { StoredColumnPref } from './types/stored-column-pref';
import { UserTableColumnPreferencesRepository } from './user-table-column-preferences.repository';

export interface EffectiveTablePreferences {
  tableName: string;
  columns: StoredColumnPref[];
  hasUserOverride: boolean;
  hasTeamDefault: boolean;
}

@Injectable()
export class TablePreferencesService {
  constructor(
    private readonly defaultsRepository: TableColumnDefaultsRepository,
    private readonly userPreferencesRepository: UserTableColumnPreferencesRepository,
  ) {}

  async getEffectivePreferences(
    userId: string,
    organizationId: string | null,
    tableName: string,
  ): Promise<EffectiveTablePreferences> {
    if (this.isPlatformTable(tableName)) {
      const userPreference =
        await this.userPreferencesRepository.findByUserAndTableName(
          userId,
          tableName,
        );

      return {
        tableName,
        columns: userPreference?.columns ?? [],
        hasUserOverride: Boolean(userPreference),
        hasTeamDefault: false,
      };
    }

    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const [teamDefault, userPreference] = await Promise.all([
      this.defaultsRepository.findByTableNameAndOrganizationId(
        tableName,
        resolvedOrganizationId,
      ),
      this.userPreferencesRepository.findByUserAndTableName(userId, tableName),
    ]);

    const columns = userPreference?.columns ?? teamDefault?.columns ?? [];

    return {
      tableName,
      columns,
      hasUserOverride: Boolean(userPreference),
      hasTeamDefault: Boolean(teamDefault),
    };
  }

  async getTeamDefaults(
    organizationId: string | null,
    tableName: string,
  ): Promise<StoredColumnPref[]> {
    const teamDefault =
      await this.defaultsRepository.findByTableNameAndOrganizationId(
        tableName,
        requireOrganizationId(organizationId),
      );

    if (!teamDefault) {
      throw new NotFoundException(
        `No team defaults found for table "${tableName}"`,
      );
    }

    return teamDefault.columns;
  }

  async upsertUserPreferences(
    user: AuthUser,
    organizationId: string | null,
    tableName: string,
    dto: UpsertTablePreferencesDto,
  ): Promise<EffectiveTablePreferences> {
    if (!this.isPlatformTable(tableName)) {
      requireOrganizationId(organizationId);
    }

    const existing =
      await this.userPreferencesRepository.findByUserAndTableName(
        user.id,
        tableName,
      );

    const columns = this.normalizeColumns(dto.columns);

    if (existing) {
      existing.columns = columns;
      await this.userPreferencesRepository.save(existing);
    } else {
      const created = this.userPreferencesRepository.create({
        userId: user.id,
        tableName,
        columns,
      });
      await this.userPreferencesRepository.save(created);
    }

    return this.getEffectivePreferences(user.id, organizationId, tableName);
  }

  async resetUserPreferences(
    userId: string,
    organizationId: string | null,
    tableName: string,
  ): Promise<EffectiveTablePreferences> {
    const existing =
      await this.userPreferencesRepository.findByUserAndTableName(
        userId,
        tableName,
      );

    if (existing) {
      await this.userPreferencesRepository.remove(existing);
    }

    return this.getEffectivePreferences(userId, organizationId, tableName);
  }

  async upsertTeamDefaults(
    user: AuthUser,
    organizationId: string | null,
    tableName: string,
    dto: UpsertTablePreferencesDto,
  ): Promise<StoredColumnPref[]> {
    this.assertCanManageDefaults(user);

    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const columns = this.normalizeColumns(dto.columns);
    const existing =
      await this.defaultsRepository.findByTableNameAndOrganizationId(
        tableName,
        resolvedOrganizationId,
      );

    if (existing) {
      existing.columns = columns;
      existing.updatedByUserId = user.id;
      await this.defaultsRepository.save(existing);
      return existing.columns;
    }

    const created = this.defaultsRepository.create({
      organizationId: resolvedOrganizationId,
      tableName,
      columns,
      updatedByUserId: user.id,
    });
    const saved = await this.defaultsRepository.save(created);
    return saved.columns;
  }

  private isPlatformTable(tableName: string): boolean {
    return tableName.startsWith('platform-');
  }

  private assertCanManageDefaults(user: AuthUser): void {
    if (!hasPermission(user, 'rbac:manage')) {
      throw new ForbiddenException(
        'You do not have permission to manage team table defaults',
      );
    }
  }

  private normalizeColumns(columns: StoredColumnPref[]): StoredColumnPref[] {
    return [...columns]
      .sort((left, right) => left.order - right.order)
      .map((column, index) => ({
        field: column.field,
        label: column.label,
        visible: column.visible,
        order: index,
      }));
  }
}
