import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CredentialsCryptoService } from '../common/crypto/credentials-crypto.service';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { CrmImportResult } from '../common/crm-import/crm-import.types';
import { CompaniesImportService } from '../companies/companies-import.service';
import { CompaniesService } from '../companies/companies.service';
import { ContactListsService } from '../contact-lists/contact-lists.service';
import { ProspectsImportService } from '../prospects/prospects-import.service';
import { ProspectsService } from '../prospects/prospects.service';
import type { ConnectNotionDto } from './dto/connect-notion.dto';
import type { NotionImportDto } from './dto/notion-import.dto';
import { NotionApiClient } from './notion-api.client';
import {
  buildNotionFieldPlan,
  type ImportableFieldDefinition,
  type NotionFieldToCreate,
  type NotionImportDestination,
} from './notion-field-match';
import { NotionIntegrationsRepository } from './notion-integrations.repository';
import {
  describeNotionProperty,
  flattenNotionPage,
  type DescribedNotionProperty,
} from './notion-property.mapper';

interface StoredNotionToken {
  token: string;
}

export interface NotionConnectionStatus {
  connected: boolean;
}

@Injectable()
export class NotionIntegrationsService {
  constructor(
    private readonly repository: NotionIntegrationsRepository,
    private readonly credentialsCrypto: CredentialsCryptoService,
    private readonly notionApiClient: NotionApiClient,
    private readonly companiesImportService: CompaniesImportService,
    private readonly prospectsImportService: ProspectsImportService,
    private readonly companiesService: CompaniesService,
    private readonly prospectsService: ProspectsService,
    private readonly contactListsService: ContactListsService,
  ) {}

  async getConnection(
    organizationId: string | null,
  ): Promise<NotionConnectionStatus> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const connection = await this.repository.findByOrganizationId(
      resolvedOrganizationId,
    );

    return { connected: Boolean(connection) };
  }

  async connect(
    dto: ConnectNotionDto,
    organizationId: string | null,
  ): Promise<NotionConnectionStatus> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const token = dto.integrationToken.trim();
    await this.notionApiClient.validateToken(token);

    const existing = await this.repository.findByOrganizationId(
      resolvedOrganizationId,
    );
    const entity = existing ?? this.repository.create(resolvedOrganizationId);
    entity.tokenEncrypted = this.credentialsCrypto.encrypt({ token });
    await this.repository.save(entity);

    return { connected: true };
  }

  async disconnect(
    organizationId: string | null,
  ): Promise<NotionConnectionStatus> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    await this.repository.deleteByOrganizationId(resolvedOrganizationId);
    return { connected: false };
  }

  async listDatabases(organizationId: string | null) {
    const token = await this.requireToken(organizationId);
    return this.notionApiClient.listDatabases(token);
  }

  async getColumns(
    databaseId: string,
    destination: NotionImportDestination,
    organizationId: string | null,
  ) {
    const token = await this.requireToken(organizationId);
    const database = await this.notionApiClient.getDatabase(token, databaseId);
    const properties = database.properties.map((property) =>
      describeNotionProperty(property),
    );
    const fields = await this.loadDestinationFields(
      destination,
      requireOrganizationId(organizationId),
    );
    const plan = buildNotionFieldPlan({
      destination,
      fields,
      properties,
      excludedPropertyIds: [],
    });

    return {
      databaseId: database.id,
      databaseTitle: database.title,
      destination,
      columns: plan.columnStatuses,
      missingRequiredLabels: plan.missingRequiredLabels,
    };
  }

  async importRows(
    dto: NotionImportDto,
    organizationId: string | null,
  ): Promise<CrmImportResult> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const token = await this.requireToken(resolvedOrganizationId);
    const database = await this.notionApiClient.getDatabase(
      token,
      dto.databaseId,
    );
    const properties = database.properties.map((property) =>
      describeNotionProperty(property),
    );
    const excludedPropertyIds = this.resolveExcludedPropertyIds(
      properties,
      dto.excludedPropertyIds ?? [],
    );
    const fields = await this.loadDestinationFields(
      dto.destination,
      resolvedOrganizationId,
    );
    const plan = buildNotionFieldPlan({
      destination: dto.destination,
      fields,
      properties,
      excludedPropertyIds,
    });

    if (plan.missingRequiredLabels.length > 0) {
      throw new BadRequestException(
        `Map required fields before importing: ${plan.missingRequiredLabels.join(', ')}`,
      );
    }

    if (plan.fieldsToCreate.length > 0) {
      await this.createDestinationFields(
        dto.destination,
        plan.fieldsToCreate,
        resolvedOrganizationId,
      );
    }

    const pages = await this.notionApiClient.queryAllPages(
      token,
      dto.databaseId,
    );
    const rows = pages.map((page) => flattenNotionPage(page));

    if (dto.destination === 'company') {
      return this.companiesImportService.importMappedRows(
        rows,
        plan.fieldMapping,
        resolvedOrganizationId,
        { onDuplicate: 'skip' },
      );
    }

    if (dto.destination === 'prospect') {
      return this.prospectsImportService.importMappedRows(
        rows,
        plan.fieldMapping,
        resolvedOrganizationId,
        { onDuplicate: 'skip' },
      );
    }

    if (!dto.contactListName?.trim()) {
      throw new BadRequestException('Contact list name is required.');
    }

    return this.contactListsService.importFromMappedRows(
      dto.contactListName.trim(),
      rows,
      {
        email: plan.fieldMapping.email ?? '',
        additionalFields: Object.entries(plan.fieldMapping)
          .filter(([key]) => key !== 'email')
          .map(([key, sourceColumn]) => ({ key, sourceColumn })),
      },
      resolvedOrganizationId,
    );
  }

  private resolveExcludedPropertyIds(
    properties: DescribedNotionProperty[],
    excludedPropertyIds: string[],
  ): string[] {
    const unsupportedIds = properties
      .filter((property) => !property.supported)
      .map((property) => property.id);

    return [...new Set([...excludedPropertyIds, ...unsupportedIds])];
  }

  private async loadDestinationFields(
    destination: NotionImportDestination,
    organizationId: string,
  ): Promise<ImportableFieldDefinition[]> {
    if (destination === 'company') {
      const schema = await this.companiesService.getFieldSchema(organizationId);
      return schema.fields;
    }

    if (destination === 'prospect') {
      const schema = await this.prospectsService.getFieldSchema(organizationId);
      return schema.fields;
    }

    return this.contactListsService.getImportableFields(organizationId);
  }

  private async createDestinationFields(
    destination: NotionImportDestination,
    fieldsToCreate: NotionFieldToCreate[],
    organizationId: string,
  ): Promise<void> {
    if (destination === 'company') {
      await this.companiesService.appendOrgCustomFields(
        fieldsToCreate.map((field) => ({
          ...field,
          type: field.type === 'multiselect' ? 'text' : field.type,
          editableOnDetail: true,
        })),
        organizationId,
      );
      return;
    }

    if (destination === 'prospect') {
      await this.prospectsService.appendOrgCustomFields(
        fieldsToCreate,
        organizationId,
      );
    }
  }

  private async requireToken(organizationId: string | null): Promise<string> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const connection = await this.repository.findByOrganizationId(
      resolvedOrganizationId,
    );

    if (!connection) {
      throw new NotFoundException('Notion is not connected.');
    }

    const stored = this.credentialsCrypto.decrypt<StoredNotionToken>(
      connection.tokenEncrypted,
    );

    if (!stored.token?.trim()) {
      throw new NotFoundException('Notion is not connected.');
    }

    return stored.token;
  }
}
