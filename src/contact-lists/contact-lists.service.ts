import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { FormsService } from '../forms/forms.service';
import { assertRequiredTableColumnsMapped } from '../forms/validation/table-column-schema.validator';
import type { FormTableColumnDefinition } from '../forms/types/form-schema.types';
import type { AuthUser } from '../auth/auth.types';
import { hasPermission } from '../auth/auth-access.utils';
import { ListCampaignMemberSyncService } from '../list-campaign-sync/list-campaign-member-sync.service';
import { ListEngagementService } from '../list-engagement/list-engagement.service';
import { ListProspectSyncService } from '../prospects/list-prospect-sync.service';
import { ContactListMembersRepository } from './contact-list-members.repository';
import {
  ContactListsRepository,
  type ContactListMemberInsert,
} from './contact-lists.repository';
import type {
  AppendContactListImportDto,
  ContactListMembersQueryDto,
  CreateContactListMemberDto,
} from './dto/contact-list-detail.dto';
import type {
  EnrollContactListMembersDto,
  RemoveContactListMemberDto,
} from './dto/list-member-campaign-sync.dto';
import type {
  AdditionalFieldMappingDto,
  CreateContactListImportDto,
  FieldMappingDto,
} from './dto/create-contact-list-import.dto';
import {
  FileParserService,
  type ImportPreviewResult,
} from '../common/file-parser/file-parser.service';
import {
  ContactListMapper,
  type ContactListAppendResponse,
  type ContactListDetailResponse,
  type ContactListEnrollMembersResponse,
  type ContactListEnrollmentOptionsResponse,
  type ContactListImportResponse,
  type ContactListMemberRemovalPreviewResponse,
  type ContactListMemberRemovalResponse,
  type ContactListMembersPageResponse,
  type ContactListMemberResponse,
  type ContactListResponse,
} from './mappers/contact-list.mapper';
import type { ContactListFieldSchema } from './types/contact-list-field-schema';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT_LIST_IMPORT_FORM_KEY = 'email.list.contact.import';

const RESERVED_KEY_ALIASES: Record<
  string,
  'firstName' | 'lastName' | 'company' | 'phone'
> = {
  firstname: 'firstName',
  lastname: 'lastName',
  company: 'company',
  phone: 'phone',
};

@Injectable()
export class ContactListsService {
  constructor(
    private readonly contactListsRepository: ContactListsRepository,
    private readonly contactListMembersRepository: ContactListMembersRepository,
    private readonly fileParserService: FileParserService,
    private readonly contactListMapper: ContactListMapper,
    private readonly listEngagementService: ListEngagementService,
    private readonly listCampaignMemberSyncService: ListCampaignMemberSyncService,
    private readonly listProspectSyncService: ListProspectSyncService,
    private readonly formsService: FormsService,
  ) {}

  findAll(organizationId: string | null): Promise<ContactListResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    return this.contactListsRepository
      .findAllByOrganizationId(resolvedOrganizationId)
      .then((lists) =>
        lists.map((list) => this.contactListMapper.toResponse(list)),
      );
  }

  async findById(
    id: string,
    organizationId: string | null,
  ): Promise<ContactListDetailResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const members = await this.contactListMembersRepository.findByListId(
      list.id,
    );
    const fieldSchema = this.contactListMapper.resolveFieldSchema(
      list,
      members,
    );

    const [stats, campaigns] = await Promise.all([
      this.listEngagementService.getStats(
        'contact',
        list.id,
        resolvedOrganizationId,
        list.contactCount,
      ),
      this.listEngagementService.getLinkedCampaigns(
        'contact',
        list.id,
        resolvedOrganizationId,
      ),
    ]);

    return this.contactListMapper.toDetailResponse(
      list,
      fieldSchema,
      stats,
      campaigns,
    );
  }

  async findMembers(
    id: string,
    query: ContactListMembersQueryDto,
    organizationId: string | null,
  ): Promise<ContactListMembersPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const allMembers = await this.contactListMembersRepository.findByListId(
      list.id,
    );
    const emailStatusMap = await this.listEngagementService.getEmailStatusMap(
      'contact',
      list.id,
      resolvedOrganizationId,
      allMembers.map((member) => member.email),
    );

    const paginated =
      await this.contactListMembersRepository.findPaginatedByListId(
        list.id,
        {
          search: query.search,
          emailStatus: query.emailStatus,
          page,
          pageSize,
        },
        emailStatusMap,
      );

    return {
      items: paginated.items.map((member) =>
        this.contactListMapper.toMemberResponse(
          member,
          emailStatusMap.get(member.email.toLowerCase()) ?? 'not_contacted',
        ),
      ),
      total: paginated.total,
      page: paginated.page,
      pageSize: paginated.pageSize,
    };
  }

  async addMember(
    id: string,
    dto: CreateContactListMemberDto,
    organizationId: string | null,
  ): Promise<ContactListMemberResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const email = dto.email.trim().toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      throw new BadRequestException('A valid email address is required');
    }

    const memberInsert = this.buildMemberInsertFromDto(dto, email);

    try {
      await this.contactListsRepository.addMemberAndIncrementCount(
        list,
        memberInsert,
      );
    } catch (error) {
      if (error instanceof Error && error.message === 'DUPLICATE_MEMBER') {
        throw new ConflictException(
          'A contact with this email already exists in the list',
        );
      }

      throw error;
    }

    const savedMember =
      await this.contactListMembersRepository.findByListIdAndEmail(
        list.id,
        email,
      );

    if (!savedMember) {
      throw new NotFoundException('Contact not found after creation');
    }

    const emailStatusMap = await this.listEngagementService.getEmailStatusMap(
      'contact',
      list.id,
      resolvedOrganizationId,
      [email],
    );

    return this.contactListMapper.toMemberResponse(
      savedMember,
      emailStatusMap.get(email) ?? 'not_contacted',
    );
  }

  async getMemberRemovalPreview(
    listId: string,
    memberId: string,
    organizationId: string | null,
  ): Promise<ContactListMemberRemovalPreviewResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const member = await this.contactListMembersRepository.findByIdAndListId(
      memberId,
      list.id,
    );

    if (!member) {
      throw new NotFoundException('Contact not found');
    }

    const campaignImpacts =
      await this.listCampaignMemberSyncService.getRemovalPreview(
        {
          listType: 'contact',
          listId: list.id,
          organizationId: resolvedOrganizationId,
        },
        member.email,
      );

    return {
      email: member.email,
      campaignImpacts,
    };
  }

  async removeMember(
    listId: string,
    memberId: string,
    dto: RemoveContactListMemberDto,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ContactListMemberRemovalResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);
    const member = await this.contactListMembersRepository.findByIdAndListId(
      memberId,
      list.id,
    );

    if (!member) {
      throw new NotFoundException('Contact not found');
    }

    const campaignActions = dto.campaignActions ?? [];
    let campaignResults: ContactListMemberRemovalResponse['campaignResults'] =
      [];

    if (campaignActions.length > 0) {
      campaignResults =
        await this.listCampaignMemberSyncService.removeFromCampaigns(
          resolvedOrganizationId,
          member.email,
          campaignActions,
          user,
        );
    }

    const removed =
      await this.contactListsRepository.deleteMemberAndDecrementCount(
        list,
        member.id,
      );

    if (!removed) {
      throw new NotFoundException('Contact not found');
    }

    return { removed: true, campaignResults };
  }

  async getEnrollmentOptions(
    listId: string,
    emails: string[],
    organizationId: string | null,
  ): Promise<ContactListEnrollmentOptionsResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);

    const options =
      await this.listCampaignMemberSyncService.getEnrollmentOptions(
        {
          listType: 'contact',
          listId: list.id,
          organizationId: resolvedOrganizationId,
        },
        emails,
      );

    return { options };
  }

  async enrollMembersInCampaigns(
    listId: string,
    dto: EnrollContactListMembersDto,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ContactListEnrollMembersResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(listId, resolvedOrganizationId);

    const normalizedEmails = [
      ...new Set(dto.emails.map((email) => email.trim().toLowerCase())),
    ];

    const members = await Promise.all(
      normalizedEmails.map((email) =>
        this.contactListMembersRepository.findByListIdAndEmail(list.id, email),
      ),
    );

    const inputs = members.flatMap((member) => {
      if (!member) {
        return [];
      }

      return [
        this.listCampaignMemberSyncService.resolveContactMemberMergeFields(
          member,
        ),
      ];
    });

    const results = await this.listCampaignMemberSyncService.enrollMembers(
      {
        listType: 'contact',
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

  previewImport(file: Express.Multer.File): Promise<ImportPreviewResult> {
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    return this.fileParserService.preview(validatedFile);
  }

  previewAppendImport(
    id: string,
    file: Express.Multer.File,
    organizationId: string | null,
  ): Promise<ImportPreviewResult> {
    void id;
    void organizationId;
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    return this.fileParserService.preview(validatedFile);
  }

  async importList(
    dto: CreateContactListImportDto,
    file: Express.Multer.File,
    organizationId: string | null,
    user: Pick<AuthUser, 'role' | 'permissions'>,
  ): Promise<ContactListImportResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    this.assertCanSyncProspects(dto.syncToProspects, user);
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    this.assertUniqueSourceColumns(dto.fieldMapping);

    const tableColumns = await this.formsService.resolveTableColumns(
      CONTACT_LIST_IMPORT_FORM_KEY,
      resolvedOrganizationId,
    );
    this.assertFieldMappingMatchesTableColumns(dto.fieldMapping, tableColumns);

    const parsed = await this.fileParserService.parseFile(validatedFile);
    const totalRows = parsed.rows.length;
    const mappedRows = this.mapRows(parsed.rows, dto.fieldMapping);
    const members = this.deduplicateMembers(mappedRows);
    const skippedCount = totalRows - members.length;

    if (members.length === 0) {
      throw new BadRequestException(
        'No valid contacts found. Ensure the email column is mapped and contains valid addresses.',
      );
    }

    const fieldSchema = this.buildFieldSchemaFromTableColumns(tableColumns);

    try {
      const savedList = await this.contactListsRepository.importListWithMembers(
        resolvedOrganizationId,
        dto.name.trim(),
        members,
        fieldSchema,
      );

      const response: ContactListImportResponse = {
        list: this.contactListMapper.toResponse(savedList),
        importedCount: members.length,
        skippedCount,
      };

      if (dto.syncToProspects) {
        response.prospectSync = await this.listProspectSyncService.syncRows(
          resolvedOrganizationId,
          this.listProspectSyncService.mapContactListMembers(members),
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

  async appendImport(
    id: string,
    dto: AppendContactListImportDto,
    file: Express.Multer.File,
    organizationId: string | null,
  ): Promise<ContactListAppendResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const list = await this.requireList(id, resolvedOrganizationId);
    const validatedFile = this.fileParserService.assertSupportedFile(file);
    this.assertUniqueSourceColumns(dto.fieldMapping);

    const tableColumns = await this.formsService.resolveTableColumns(
      CONTACT_LIST_IMPORT_FORM_KEY,
      resolvedOrganizationId,
    );
    this.assertFieldMappingMatchesTableColumns(dto.fieldMapping, tableColumns);

    const parsed = await this.fileParserService.parseFile(validatedFile);
    const totalRows = parsed.rows.length;
    const mappedRows = this.mapRows(parsed.rows, dto.fieldMapping);
    const members = this.deduplicateMembers(mappedRows);
    const skippedCount = totalRows - members.length;

    if (members.length === 0) {
      throw new BadRequestException(
        'No valid contacts found. Ensure the email column is mapped and contains valid addresses.',
      );
    }

    const {
      list: savedList,
      importedCount,
      importedEmails,
    } = await this.contactListsRepository.appendMembersAndUpdateCount(
      list,
      members,
    );

    return {
      list: this.contactListMapper.toResponse(savedList),
      importedCount,
      skippedCount,
      importedEmails,
    };
  }

  private async requireList(id: string, organizationId: string) {
    const list = await this.contactListsRepository.findByIdAndOrganizationId(
      id,
      organizationId,
    );

    if (!list) {
      throw new NotFoundException('Contact list not found');
    }

    return list;
  }

  private buildMemberInsertFromDto(
    dto: CreateContactListMemberDto,
    email: string,
  ): ContactListMemberInsert {
    return {
      email,
      firstName: dto.firstName?.trim() || null,
      lastName: dto.lastName?.trim() || null,
      company: dto.company?.trim() || null,
      phone: dto.phone?.trim() || null,
      customFields: dto.customFields ?? {},
    };
  }

  private buildFieldSchemaFromTableColumns(
    tableColumns: FormTableColumnDefinition[],
  ): ContactListFieldSchema {
    const emailColumn =
      tableColumns.find((column) => column.type === 'email') ??
      ({ key: 'email', label: 'Email' } as const);

    return {
      email: { key: emailColumn.key, label: emailColumn.label },
      fields: tableColumns
        .filter((column) => column.key !== emailColumn.key)
        .map((column) => ({
          key: column.key,
          label: column.label,
        })),
    };
  }

  private assertFieldMappingMatchesTableColumns(
    fieldMapping: FieldMappingDto,
    tableColumns: FormTableColumnDefinition[],
  ): void {
    const emailColumn = tableColumns.find((column) => column.type === 'email');
    const emailKey = emailColumn?.key ?? 'email';

    const mappings = [
      { targetColumnKey: emailKey, sourceColumn: fieldMapping.email },
      ...fieldMapping.additionalFields.map((field) => ({
        targetColumnKey: field.key,
        sourceColumn: field.sourceColumn,
      })),
    ];

    assertRequiredTableColumnsMapped(tableColumns, mappings);
  }

  private assertUniqueSourceColumns(fieldMapping: FieldMappingDto): void {
    const usedColumns = new Set<string>();
    const columnsToCheck = [
      fieldMapping.email,
      ...fieldMapping.additionalFields.flatMap((field) =>
        [field.sourceColumn, field.secondarySourceColumn].filter(
          (column): column is string => Boolean(column?.trim()),
        ),
      ),
    ];

    for (const column of columnsToCheck) {
      const trimmed = column.trim();
      if (usedColumns.has(trimmed)) {
        throw new BadRequestException(
          `Column "${trimmed}" is mapped more than once`,
        );
      }

      usedColumns.add(trimmed);
    }

    const keys = new Set<string>();
    for (const field of fieldMapping.additionalFields) {
      const normalizedKey = this.normalizeFieldKey(field.key);
      if (keys.has(normalizedKey)) {
        throw new BadRequestException('Field names must be unique');
      }

      keys.add(normalizedKey);

      if (
        field.secondarySourceColumn?.trim() &&
        field.secondarySourceColumn.trim() === field.sourceColumn.trim()
      ) {
        throw new BadRequestException(
          'Merge column must differ from the primary column',
        );
      }
    }
  }

  private mapRows(
    rows: Record<string, string>[],
    fieldMapping: FieldMappingDto,
  ): ContactListMemberInsert[] {
    const mappedRows: ContactListMemberInsert[] = [];

    for (const row of rows) {
      const email = this.readMappedValue(row, fieldMapping.email);
      if (!email || !EMAIL_PATTERN.test(email)) {
        continue;
      }

      const member: ContactListMemberInsert = {
        email: email.toLowerCase(),
        firstName: null,
        lastName: null,
        company: null,
        phone: null,
        customFields: {},
      };

      for (const field of fieldMapping.additionalFields) {
        const value = this.readMergedValue(row, field);
        if (!value) {
          continue;
        }

        this.applyAdditionalField(member, field.key, value);
      }

      mappedRows.push(member);
    }

    return mappedRows;
  }

  private applyAdditionalField(
    member: ContactListMemberInsert,
    key: string,
    value: string,
  ): void {
    const reservedKey = this.getReservedStandardKey(key);

    switch (reservedKey) {
      case 'firstName':
        member.firstName = value;
        return;
      case 'lastName':
        member.lastName = value;
        return;
      case 'company':
        member.company = value;
        return;
      case 'phone':
        member.phone = value;
        return;
      default:
        member.customFields[key.trim()] = value;
    }
  }

  private readMergedValue(
    row: Record<string, string>,
    field: AdditionalFieldMappingDto,
  ): string | null {
    const primary = this.readMappedValue(row, field.sourceColumn);
    const secondary = field.secondarySourceColumn
      ? this.readMappedValue(row, field.secondarySourceColumn)
      : '';
    const merged = [primary, secondary]
      .map((value) => value.trim())
      .filter(Boolean)
      .join(' ');

    return merged.length > 0 ? merged : null;
  }

  private deduplicateMembers(
    rows: ContactListMemberInsert[],
  ): ContactListMemberInsert[] {
    const byEmail = new Map<string, ContactListMemberInsert>();

    for (const row of rows) {
      byEmail.set(row.email, row);
    }

    return [...byEmail.values()];
  }

  private readMappedValue(
    row: Record<string, string>,
    sourceColumn: string,
  ): string {
    return (row[sourceColumn] ?? '').trim();
  }

  private normalizeFieldKey(key: string): string {
    return key
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  private getReservedStandardKey(
    key: string,
  ): 'firstName' | 'lastName' | 'company' | 'phone' | null {
    return RESERVED_KEY_ALIASES[this.normalizeFieldKey(key)] ?? null;
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
