import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { FileParserService } from '../common/file-parser/file-parser.service';
import { FormsService } from '../forms/forms.service';
import { assertRequiredTableColumnsMapped } from '../forms/validation/table-column-schema.validator';
import type { FormTableColumnDefinition } from '../forms/types/form-schema.types';
import { ListCampaignMemberSyncService } from '../list-campaign-sync/list-campaign-member-sync.service';
import { ListEngagementService } from '../list-engagement/list-engagement.service';
import { ListProspectSyncService } from '../prospects/list-prospect-sync.service';
import type { CreateManualListDto } from './dto/create-manual-list.dto';
import type {
  AppendManualListImportDto,
  CreateManualListRowDto,
} from './dto/manual-list-detail.dto';
import type {
  EnrollManualListRowsDto,
  RemoveContactListMemberDto,
} from '../contact-lists/dto/list-member-campaign-sync.dto';
import type { ManualListColumnDefinition } from './entities/manual-list.entity';
import {
  ManualListMapper,
  type ManualListAppendResponse,
  type ManualListCreateResponse,
  type ManualListDetailResponse,
  type ManualListEnrollRowsResponse,
  type ManualListEnrollmentOptionsResponse,
  type ManualListRowRemovalPreviewResponse,
  type ManualListRowRemovalResponse,
  type ManualListRowResponse,
  type ManualListSummaryResponse,
} from './mappers/manual-list.mapper';
import {
  ManualListsRepository,
  type ManualListRowInsert,
} from './manual-lists.repository';

const MANUAL_LIST_IMPORT_FORM_KEY = 'email.list.manual.import';

@Injectable()
export class ManualListsService {
  constructor(
    private readonly manualListsRepository: ManualListsRepository,
    private readonly manualListMapper: ManualListMapper,
    private readonly listEngagementService: ListEngagementService,
    private readonly listCampaignMemberSyncService: ListCampaignMemberSyncService,
    private readonly fileParserService: FileParserService,
    private readonly listProspectSyncService: ListProspectSyncService,
    private readonly formsService: FormsService,
  ) {}

  findAll(organizationId: string | null): Promise<ManualListSummaryResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    return this.manualListsRepository
      .findAllByOrganizationId(resolvedOrganizationId)
      .then((lists) =>
        lists.map((list) => this.manualListMapper.toSummary(list)),
      );
  }

  async findById(
    id: string,
    organizationId: string | null,
  ): Promise<ManualListDetailResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const rows = await this.manualListsRepository.findRowsByListId(list.id);

    const [stats, campaigns] = await Promise.all([
      this.listEngagementService.getStats(
        'manual',
        list.id,
        resolvedOrganizationId,
        list.rowCount,
      ),
      this.listEngagementService.getLinkedCampaigns(
        'manual',
        list.id,
        resolvedOrganizationId,
      ),
    ]);

    return this.manualListMapper.toDetail(list, rows, stats, campaigns);
  }

  async create(
    dto: CreateManualListDto,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ManualListCreateResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    this.assertCanSyncProspects(dto.syncToProspects, user);
    const columns = this.buildColumns(dto.columns);
    const columnKeys = new Set(columns.map((column) => column.key));
    const rows = this.buildRows(dto.rows, columnKeys);

    try {
      const savedList = await this.manualListsRepository.createListWithRows(
        resolvedOrganizationId,
        dto.name.trim(),
        columns,
        rows,
      );

      const savedRows = await this.manualListsRepository.findRowsByListId(
        savedList.id,
      );

      const detail = this.manualListMapper.toDetail(
        savedList,
        savedRows,
        {
          totalContacts: savedList.rowCount,
          eligible: savedList.rowCount,
          sent: 0,
          replied: 0,
        },
        [],
      );

      const response: ManualListCreateResponse = { ...detail };

      if (dto.syncToProspects) {
        const rowValues = savedRows.map((row) => row.data);
        const mapping = dto.prospectFieldMapping
          ? {
              emailColumnKey: dto.prospectFieldMapping.emailColumnKey,
              nameColumnKey: dto.prospectFieldMapping.nameColumnKey,
            }
          : undefined;

        response.prospectSync = await this.listProspectSyncService.syncRows(
          resolvedOrganizationId,
          this.listProspectSyncService.mapManualListRows(
            columns,
            rowValues,
            mapping,
          ),
        );
      }

      return response;
    } catch (error) {
      if (this.isUniqueNameViolation(error)) {
        throw new ConflictException(
          'A list with this name already exists in your organization',
        );
      }

      throw error;
    }
  }

  async addRow(
    id: string,
    dto: CreateManualListRowDto,
    organizationId: string | null,
  ): Promise<ManualListRowResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const data = this.buildRowData(list.columns, dto.values);

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('At least one column value is required');
    }

    const savedList = await this.manualListsRepository.appendRow(list, data);
    const rows = await this.manualListsRepository.findRowsByListId(
      savedList.id,
    );
    const latestRow = rows[rows.length - 1];

    if (!latestRow) {
      throw new NotFoundException('Row not found after creation');
    }

    return this.manualListMapper.toRowResponse(latestRow);
  }

  async getRowRemovalPreview(
    listId: string,
    rowId: string,
    organizationId: string | null,
  ): Promise<ManualListRowRemovalPreviewResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const row = await this.manualListsRepository.findRowByIdAndListId(
      rowId,
      list.id,
    );

    if (!row) {
      throw new NotFoundException('Row not found');
    }

    const email = this.resolveRowEmail(list.columns, row.data);
    const campaignImpacts = email
      ? await this.listCampaignMemberSyncService.getRemovalPreview(
          {
            listType: 'manual',
            listId: list.id,
            organizationId: resolvedOrganizationId,
          },
          email,
        )
      : [];

    return {
      email,
      campaignImpacts,
    };
  }

  async removeRow(
    listId: string,
    rowId: string,
    dto: RemoveContactListMemberDto,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ManualListRowRemovalResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const row = await this.manualListsRepository.findRowByIdAndListId(
      rowId,
      list.id,
    );

    if (!row) {
      throw new NotFoundException('Row not found');
    }

    const email = this.resolveRowEmail(list.columns, row.data);
    const campaignActions = dto.campaignActions ?? [];
    let campaignResults: ManualListRowRemovalResponse['campaignResults'] = [];

    if (campaignActions.length > 0 && email) {
      campaignResults =
        await this.listCampaignMemberSyncService.removeFromCampaigns(
          resolvedOrganizationId,
          email,
          campaignActions,
          user,
        );
    }

    const deletedRow =
      await this.manualListsRepository.deleteRowAndDecrementCount(list, row.id);

    if (!deletedRow) {
      throw new NotFoundException('Row not found');
    }

    return { removed: true, campaignResults };
  }

  async getEnrollmentOptions(
    listId: string,
    rowIds: string[],
    organizationId: string | null,
  ): Promise<ManualListEnrollmentOptionsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const rows = await this.manualListsRepository.findRowsByIdsAndListId(
      rowIds,
      list.id,
    );

    const emails = rows
      .map((row) => this.resolveRowEmail(list.columns, row.data))
      .filter((email): email is string => Boolean(email));

    const options =
      await this.listCampaignMemberSyncService.getEnrollmentOptions(
        {
          listType: 'manual',
          listId: list.id,
          organizationId: resolvedOrganizationId,
        },
        emails,
      );

    return { options };
  }

  async enrollRowsInCampaigns(
    listId: string,
    dto: EnrollManualListRowsDto,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ManualListEnrollRowsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const rows = await this.manualListsRepository.findRowsByIdsAndListId(
      dto.rowIds,
      list.id,
    );

    const inputs = rows.flatMap((row) => {
      try {
        return [
          this.listCampaignMemberSyncService.resolveManualRowMergeFields(
            list.columns,
            row,
          ),
        ];
      } catch {
        return [];
      }
    });

    const results = await this.listCampaignMemberSyncService.enrollMembers(
      {
        listType: 'manual',
        listId: list.id,
        organizationId: resolvedOrganizationId,
      },
      inputs,
      dto.campaignIds,
      user,
    );

    const addedCount = results.filter((result) => result.success).length;
    const skippedCount = results.length - addedCount;

    return { results, addedCount, skippedCount };
  }

  previewAppendImport(
    id: string,
    file: Express.Multer.File,
    organizationId: string | null,
  ) {
    void id;
    void organizationId;
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    return this.fileParserService.preview(validatedFile);
  }

  async appendImport(
    id: string,
    dto: AppendManualListImportDto,
    file: Express.Multer.File,
    organizationId: string | null,
  ): Promise<ManualListAppendResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    const parsed = await this.fileParserService.parseFile(validatedFile);

    const tableColumns = await this.formsService.resolveTableColumns(
      MANUAL_LIST_IMPORT_FORM_KEY,
      resolvedOrganizationId,
    );
    this.assertManualImportMappings(list.columns, dto, tableColumns);

    const totalRows = parsed.rows.length;
    const rows = this.mapImportRows(list.columns, parsed.rows, dto);
    const skippedCount = totalRows - rows.length;

    if (rows.length === 0) {
      throw new BadRequestException(
        'No valid rows found. Check your column mappings.',
      );
    }

    const {
      list: savedList,
      importedCount,
      importedRowIds,
    } = await this.manualListsRepository.appendRows(list, rows);

    return {
      list: this.manualListMapper.toSummary(savedList),
      importedCount,
      skippedCount,
      importedRowIds,
    };
  }

  private resolveRowEmail(
    columns: ManualListColumnDefinition[],
    data: Record<string, string>,
  ): string | null {
    const emailColumn = columns.find(
      (column) => /^email$/i.test(column.key) || /^email$/i.test(column.label),
    );

    if (emailColumn) {
      const candidate = data[emailColumn.key]?.trim().toLowerCase();
      if (candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
        return candidate;
      }
    }

    for (const value of Object.values(data)) {
      const candidate = value?.trim().toLowerCase();
      if (candidate && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private async requireList(id: string, organizationId: string) {
    const list = await this.manualListsRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!list) {
      throw new NotFoundException('Manual list not found');
    }

    return list;
  }

  private assertManualImportMappings(
    listColumns: ManualListColumnDefinition[],
    dto: AppendManualListImportDto,
    tableColumns: FormTableColumnDefinition[],
  ): void {
    const listColumnKeys = new Set(listColumns.map((column) => column.key));
    const requiredColumns = tableColumns.filter(
      (column) => column.required && listColumnKeys.has(column.key),
    );

    assertRequiredTableColumnsMapped(
      requiredColumns,
      dto.columnMappings.map((mapping) => ({
        targetColumnKey: mapping.listColumnKey,
        sourceColumn: mapping.sourceColumn,
      })),
    );
  }

  private buildRowData(
    columns: ManualListColumnDefinition[],
    values: Record<string, string>,
  ): Record<string, string> {
    const allowedKeys = new Set(columns.map((column) => column.key));
    const data: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(values)) {
      if (!allowedKeys.has(key)) {
        continue;
      }

      const value = rawValue.trim();
      if (value) {
        data[key] = value;
      }
    }

    return data;
  }

  private mapImportRows(
    columns: ManualListColumnDefinition[],
    sourceRows: Record<string, string>[],
    dto: AppendManualListImportDto,
  ): ManualListRowInsert[] {
    const mappingByKey = new Map(
      dto.columnMappings.map((mapping) => [
        mapping.listColumnKey,
        mapping.sourceColumn.trim(),
      ]),
    );
    const allowedKeys = new Set(columns.map((column) => column.key));
    const rows: ManualListRowInsert[] = [];

    sourceRows.forEach((sourceRow, index) => {
      const data: Record<string, string> = {};

      for (const column of columns) {
        const sourceColumn = mappingByKey.get(column.key);
        if (!sourceColumn || !allowedKeys.has(column.key)) {
          continue;
        }

        const value = (sourceRow[sourceColumn] ?? '').trim();
        if (value) {
          data[column.key] = value;
        }
      }

      if (Object.keys(data).length > 0) {
        rows.push({ rowIndex: index, data });
      }
    });

    return rows;
  }

  private buildColumns(
    columnDtos: CreateManualListDto['columns'],
  ): ManualListColumnDefinition[] {
    const usedLabels = new Set<string>();
    const usedKeys = new Set<string>();
    const columns: ManualListColumnDefinition[] = [];

    for (const columnDto of columnDtos) {
      const label = columnDto.label.trim();
      const normalizedLabel = label.toLowerCase();

      if (usedLabels.has(normalizedLabel)) {
        throw new BadRequestException('Column labels must be unique');
      }

      usedLabels.add(normalizedLabel);

      const key = this.resolveUniqueKey(label, usedKeys);
      usedKeys.add(key);
      columns.push({ key, label });
    }

    return columns;
  }

  private buildRows(
    rowDtos: CreateManualListDto['rows'],
    columnKeys: Set<string>,
  ): ManualListRowInsert[] {
    const rows: ManualListRowInsert[] = [];

    rowDtos.forEach((rowDto, index) => {
      const data: Record<string, string> = {};

      for (const key of columnKeys) {
        const value = (rowDto.values[key] ?? '').trim();
        if (value) {
          data[key] = value;
        }
      }

      if (Object.keys(data).length === 0) {
        return;
      }

      rows.push({
        rowIndex: index,
        data,
      });
    });

    return rows;
  }

  private resolveUniqueKey(label: string, usedKeys: Set<string>): string {
    const baseKey = this.slugifyLabel(label);

    if (!baseKey) {
      throw new BadRequestException(
        'Column label must contain valid characters',
      );
    }

    if (!usedKeys.has(baseKey)) {
      return baseKey;
    }

    let suffix = 2;
    while (usedKeys.has(`${baseKey}_${suffix}`)) {
      suffix += 1;
    }

    return `${baseKey}_${suffix}`;
  }

  private slugifyLabel(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/^_+|_+$/g, '');
  }

  private assertCanSyncProspects(
    syncToProspects: boolean | undefined,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): void {
    if (syncToProspects && !hasPermission(user, 'prospects:create')) {
      throw new ForbiddenException(
        'Insufficient permissions to sync prospects',
      );
    }
  }

  private isUniqueNameViolation(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const driverError = (error as Error & { driverError?: { code?: string } })
      .driverError;

    return driverError?.code === '23505';
  }
}
