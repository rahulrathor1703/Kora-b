import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContactListMembersRepository } from '../contact-lists/contact-list-members.repository';
import { ContactListsRepository } from '../contact-lists/contact-lists.repository';
import { ContactListsService } from '../contact-lists/contact-lists.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { ManualListsRepository } from '../manual-lists/manual-lists.repository';
import { ManualListsService } from '../manual-lists/manual-lists.service';
import { AudienceContactsRepository } from './audience-contacts.repository';
import { CampaignAudienceResolverService } from './campaign-audience-resolver.service';
import type { AssignAudienceContactToListDto } from './dto/assign-audience-contact-to-list.dto';
import type { CreateAudienceContactDto } from './dto/create-audience-contact.dto';
import { normalizeMergeFieldKey } from './merge-field-key.util';
import type { AudienceContactEntity } from './entities/audience-contact.entity';
import type { EmailExcludedListType } from './dto/create-email-excluded.dto';
import type { EmailExcludedListContactsQueryDto } from './dto/email-excluded-list-contacts-query.dto';
import { EmailCampaignRecipientsRepository } from './email-campaign-recipients.repository';
import { EmailExcludedRepository } from './email-excluded.repository';

export interface EmailExcludedAddressResponse {
  id: string;
  email: string;
  reason: string;
  sourceCampaignId: string | null;
  createdAt: string;
}

export interface ExcludeFromListResult {
  excludedCount: number;
  totalCount: number;
}

export interface EmailExcludedListContactResponse {
  email: string;
  name: string;
  listNames: string[];
  isExcluded: boolean;
  isUnassigned: boolean;
}

export interface EmailExcludedListContactsPageResponse {
  items: EmailExcludedListContactResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface AudienceContactResponse {
  id: string;
  email: string;
  name: string;
  listNames: string[];
  isExcluded: boolean;
  createdAt: string;
}

interface BrowseContactAccumulator {
  email: string;
  name: string;
  listNames: Set<string>;
}

@Injectable()
export class EmailExcludedService {
  constructor(
    private readonly excludedRepository: EmailExcludedRepository,
    private readonly recipientsRepository: EmailCampaignRecipientsRepository,
    private readonly contactListsRepository: ContactListsRepository,
    private readonly contactListMembersRepository: ContactListMembersRepository,
    private readonly manualListsRepository: ManualListsRepository,
    private readonly audienceContactsRepository: AudienceContactsRepository,
    private readonly contactListsService: ContactListsService,
    private readonly manualListsService: ManualListsService,
    private readonly audienceResolver: CampaignAudienceResolverService,
  ) {}

  async findAll(organizationId: string | null) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const rows = await this.excludedRepository.findByOrganizationId(
      resolvedOrganizationId,
    );

    return rows.map((row) => this.toResponse(row));
  }

  async add(
    email: string,
    organizationId: string | null,
  ): Promise<EmailExcludedAddressResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const row = await this.excludeEmail(
      resolvedOrganizationId,
      normalizedEmail,
      'Manually excluded',
    );

    return this.toResponse(row);
  }

  async excludeFromList(
    listId: string,
    listType: EmailExcludedListType,
    organizationId: string | null,
  ): Promise<ExcludeFromListResult> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const emails = await this.resolveListEmails(
      listId,
      listType,
      resolvedOrganizationId,
    );

    if (emails.length === 0) {
      throw new BadRequestException('No valid email addresses found in list');
    }

    let excludedCount = 0;

    for (const email of emails) {
      const existing =
        await this.excludedRepository.findByOrganizationIdAndEmail(
          resolvedOrganizationId,
          email,
        );

      if (existing) {
        continue;
      }

      await this.excludeEmail(
        resolvedOrganizationId,
        email,
        'Manually excluded from list',
      );
      excludedCount += 1;
    }

    return {
      excludedCount,
      totalCount: emails.length,
    };
  }

  async findAllListContacts(
    query: EmailExcludedListContactsQueryDto,
    organizationId: string | null,
  ): Promise<EmailExcludedListContactsPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const includeManual = query.includeManual ?? true;
    const search = query.search?.trim().toLowerCase() ?? '';

    const [excludedEmails, contactLists] = await Promise.all([
      this.excludedRepository.findEmailsByOrganizationId(
        resolvedOrganizationId,
      ),
      this.contactListsRepository.findAllByOrganizationId(
        resolvedOrganizationId,
      ),
    ]);

    const excludedEmailSet = new Set(
      excludedEmails.map((email) => email.toLowerCase()),
    );
    const contactsByEmail = new Map<string, BrowseContactAccumulator>();

    for (const list of contactLists) {
      const members = await this.contactListMembersRepository.findByListId(
        list.id,
      );
      const resolvedMembers =
        this.audienceResolver.resolveContactListMembers(members);

      for (const member of resolvedMembers) {
        this.mergeBrowseContact(contactsByEmail, {
          email: member.email,
          name: [member.mergeFields.first_name, member.mergeFields.last_name]
            .filter(Boolean)
            .join(' ')
            .trim(),
          listName: list.name,
        });
      }
    }

    if (includeManual) {
      const manualLists =
        await this.manualListsRepository.findAllByOrganizationId(
          resolvedOrganizationId,
        );

      for (const list of manualLists) {
        const rows = await this.manualListsRepository.findRowsByListId(list.id);
        const resolvedRows = this.audienceResolver.resolveManualListRows(
          list.columns,
          rows,
        );

        for (const row of resolvedRows) {
          this.mergeBrowseContact(contactsByEmail, {
            email: row.email,
            name:
              row.mergeFields.full_name?.trim() ||
              [row.mergeFields.first_name, row.mergeFields.last_name]
                .filter(Boolean)
                .join(' ')
                .trim(),
            listName: list.name,
          });
        }
      }
    }

    const audienceContacts =
      await this.audienceContactsRepository.findByOrganizationId(
        resolvedOrganizationId,
      );
    const unassignedEmailSet = new Set(
      audienceContacts.map((contact) => contact.email.toLowerCase()),
    );

    for (const contact of audienceContacts) {
      this.mergeBrowseContactWithoutList(contactsByEmail, {
        email: contact.email,
        name: [contact.firstName, contact.lastName]
          .filter(Boolean)
          .join(' ')
          .trim(),
      });
    }

    let contacts = [...contactsByEmail.values()].map((contact) => ({
      email: contact.email,
      name: contact.name,
      listNames: [...contact.listNames].sort((left, right) =>
        left.localeCompare(right),
      ),
      isExcluded: excludedEmailSet.has(contact.email),
      isUnassigned: unassignedEmailSet.has(contact.email),
    }));

    contacts.sort((left, right) => left.email.localeCompare(right.email));

    if (search) {
      contacts = contacts.filter((contact) => {
        const haystack = [contact.email, contact.name, ...contact.listNames]
          .join(' ')
          .toLowerCase();

        return haystack.includes(search);
      });
    }

    const total = contacts.length;
    const start = (page - 1) * limit;
    const items = contacts.slice(start, start + limit).map((contact) => ({
      email: contact.email,
      name: contact.name,
      listNames: contact.listNames,
      isExcluded: contact.isExcluded,
      isUnassigned: contact.isUnassigned,
    }));

    return {
      items,
      total,
      page,
      limit,
    };
  }

  async createAudienceContact(
    dto: CreateAudienceContactDto,
    organizationId: string | null,
  ): Promise<AudienceContactResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (!normalizedEmail) {
      throw new BadRequestException('Email is required');
    }

    const existing =
      await this.audienceContactsRepository.findByOrganizationIdAndEmail(
        resolvedOrganizationId,
        normalizedEmail,
      );

    if (existing) {
      throw new ConflictException('A contact with this email already exists');
    }

    const alreadyInList = await this.isEmailInAnyList(
      resolvedOrganizationId,
      normalizedEmail,
    );

    if (alreadyInList) {
      throw new ConflictException(
        'This email already belongs to a list. Add it from the list detail page instead.',
      );
    }

    const contact = await this.audienceContactsRepository.create({
      organizationId: resolvedOrganizationId,
      email: normalizedEmail,
      firstName: dto.firstName?.trim() || null,
      lastName: dto.lastName?.trim() || null,
      company: dto.company?.trim() || null,
      phone: dto.phone?.trim() || null,
      customFields: dto.customFields ?? {},
    });

    const excludedEmails =
      await this.excludedRepository.findEmailsByOrganizationId(
        resolvedOrganizationId,
      );
    const excludedEmailSet = new Set(
      excludedEmails.map((email) => email.toLowerCase()),
    );
    const name = [contact.firstName, contact.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return {
      id: contact.id,
      email: contact.email,
      name,
      listNames: [],
      isExcluded: excludedEmailSet.has(contact.email),
      createdAt: contact.createdAt.toISOString(),
    };
  }

  async assignAudienceContactToList(
    dto: AssignAudienceContactToListDto,
    organizationId: string | null,
  ): Promise<EmailExcludedListContactResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const normalizedEmail = dto.email.trim().toLowerCase();

    const audienceContact =
      await this.audienceContactsRepository.findByOrganizationIdAndEmail(
        resolvedOrganizationId,
        normalizedEmail,
      );

    if (!audienceContact) {
      throw new NotFoundException(
        'Unassigned contact not found. Only standalone audience contacts can be added to a list from here.',
      );
    }

    if (dto.listType === 'contact') {
      await this.contactListsService.addMember(
        dto.listId,
        {
          email: audienceContact.email,
          firstName: audienceContact.firstName ?? undefined,
          lastName: audienceContact.lastName ?? undefined,
          company: audienceContact.company ?? undefined,
          phone: audienceContact.phone ?? undefined,
          customFields: audienceContact.customFields,
        },
        resolvedOrganizationId,
      );
    } else {
      const list = await this.manualListsRepository.findByIdAndOrganizationId(
        dto.listId,
        resolvedOrganizationId,
      );

      if (!list) {
        throw new NotFoundException('Manual list not found');
      }

      await this.manualListsService.addRow(
        dto.listId,
        {
          values: this.buildManualListValuesFromAudienceContact(
            list.columns,
            audienceContact,
          ),
        },
        resolvedOrganizationId,
      );
    }

    await this.audienceContactsRepository.deleteByOrganizationIdAndEmail(
      resolvedOrganizationId,
      normalizedEmail,
    );

    const listName = await this.resolveListName(
      dto.listId,
      dto.listType,
      resolvedOrganizationId,
    );
    const excludedEmails =
      await this.excludedRepository.findEmailsByOrganizationId(
        resolvedOrganizationId,
      );

    return {
      email: normalizedEmail,
      name: [audienceContact.firstName, audienceContact.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      listNames: listName ? [listName] : [],
      isExcluded: excludedEmails.some(
        (email) => email.toLowerCase() === normalizedEmail,
      ),
      isUnassigned: false,
    };
  }

  async remove(id: string, organizationId: string | null): Promise<void> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const deleted = await this.excludedRepository.deleteByIdAndOrganizationId(
      id,
      resolvedOrganizationId,
    );

    if (!deleted) {
      throw new NotFoundException('Excluded address not found');
    }
  }

  private async excludeEmail(
    organizationId: string,
    email: string,
    reason: string,
  ) {
    const row = await this.excludedRepository.upsertExcludedAddress({
      organizationId,
      email,
      reason,
      sourceCampaignId: null,
    });

    await this.recipientsRepository.stopActiveRecipientsByEmailInOrganization(
      organizationId,
      email,
    );

    return row;
  }

  private buildManualListValuesFromAudienceContact(
    columns: Array<{ key: string; label: string }>,
    contact: AudienceContactEntity,
  ): Record<string, string> {
    const sourceValues: Record<string, string> = {
      email: contact.email,
      first_name: contact.firstName?.trim() ?? '',
      last_name: contact.lastName?.trim() ?? '',
      full_name: [contact.firstName, contact.lastName]
        .filter(Boolean)
        .join(' ')
        .trim(),
      company: contact.company?.trim() ?? '',
      phone: contact.phone?.trim() ?? '',
      ...contact.customFields,
    };
    const values: Record<string, string> = {};

    for (const column of columns) {
      const normalizedKey = normalizeMergeFieldKey(column.key, column.label);
      const directValue = contact.customFields[column.key]?.trim();
      const normalizedValue = sourceValues[normalizedKey]?.trim();
      const keyValue = sourceValues[column.key]?.trim();

      if (directValue) {
        values[column.key] = directValue;
      } else if (normalizedValue) {
        values[column.key] = normalizedValue;
      } else if (keyValue) {
        values[column.key] = keyValue;
      }
    }

    const emailColumn = columns.find(
      (column) =>
        normalizeMergeFieldKey(column.key, column.label) === 'email' ||
        /^email$/i.test(column.key) ||
        /^email$/i.test(column.label),
    );

    if (emailColumn && !values[emailColumn.key]) {
      values[emailColumn.key] = contact.email;
    }

    if (Object.keys(values).length === 0) {
      throw new BadRequestException(
        'Could not map contact fields to the selected manual list columns',
      );
    }

    return values;
  }

  private async resolveListName(
    listId: string,
    listType: EmailExcludedListType,
    organizationId: string,
  ): Promise<string | null> {
    if (listType === 'contact') {
      const list = await this.contactListsRepository.findByIdAndOrganizationId(
        listId,
        organizationId,
      );
      return list?.name ?? null;
    }

    const list = await this.manualListsRepository.findByIdAndOrganizationId(
      listId,
      organizationId,
    );
    return list?.name ?? null;
  }

  private mergeBrowseContactWithoutList(
    contactsByEmail: Map<string, BrowseContactAccumulator>,
    input: { email: string; name: string },
  ): void {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = contactsByEmail.get(normalizedEmail);

    if (existing) {
      if (!existing.name && input.name) {
        existing.name = input.name;
      }

      return;
    }

    contactsByEmail.set(normalizedEmail, {
      email: normalizedEmail,
      name: input.name,
      listNames: new Set(),
    });
  }

  private async isEmailInAnyList(
    organizationId: string,
    email: string,
  ): Promise<boolean> {
    const contactLists =
      await this.contactListsRepository.findAllByOrganizationId(organizationId);

    for (const list of contactLists) {
      const members = await this.contactListMembersRepository.findByListId(
        list.id,
      );
      const resolvedMembers =
        this.audienceResolver.resolveContactListMembers(members);

      if (
        resolvedMembers.some(
          (member) => member.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        return true;
      }
    }

    const manualLists =
      await this.manualListsRepository.findAllByOrganizationId(organizationId);

    for (const list of manualLists) {
      const rows = await this.manualListsRepository.findRowsByListId(list.id);
      const resolvedRows = this.audienceResolver.resolveManualListRows(
        list.columns,
        rows,
      );

      if (
        resolvedRows.some(
          (row) => row.email.toLowerCase() === email.toLowerCase(),
        )
      ) {
        return true;
      }
    }

    return false;
  }

  private mergeBrowseContact(
    contactsByEmail: Map<string, BrowseContactAccumulator>,
    input: { email: string; name: string; listName: string },
  ): void {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = contactsByEmail.get(normalizedEmail);

    if (existing) {
      existing.listNames.add(input.listName);

      if (!existing.name && input.name) {
        existing.name = input.name;
      }

      return;
    }

    contactsByEmail.set(normalizedEmail, {
      email: normalizedEmail,
      name: input.name,
      listNames: new Set([input.listName]),
    });
  }

  private async resolveListEmails(
    listId: string,
    listType: EmailExcludedListType,
    organizationId: string,
  ): Promise<string[]> {
    if (listType === 'contact') {
      const list = await this.contactListsRepository.findByIdAndOrganizationId(
        listId,
        organizationId,
      );

      if (!list) {
        throw new NotFoundException('Contact list not found');
      }

      const members =
        await this.contactListMembersRepository.findByListId(listId);

      return this.audienceResolver
        .resolveContactListMembers(members)
        .map((recipient) => recipient.email);
    }

    const list = await this.manualListsRepository.findByIdAndOrganizationId(
      listId,
      organizationId,
    );

    if (!list) {
      throw new NotFoundException('Manual list not found');
    }

    const rows = await this.manualListsRepository.findRowsByListId(listId);

    return this.audienceResolver
      .resolveManualListRows(list.columns, rows)
      .map((recipient) => recipient.email);
  }

  private toResponse(row: {
    id: string;
    email: string;
    reason: string;
    sourceCampaignId: string | null;
    createdAt: Date;
  }): EmailExcludedAddressResponse {
    return {
      id: row.id,
      email: row.email,
      reason: row.reason,
      sourceCampaignId: row.sourceCampaignId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
