import { Injectable } from '@nestjs/common';
import type { AuditLogAction } from './audit-log.types';
import { AuditLogResourceLabelRepository } from './audit-log-resource-label.repository';
import {
  extractParentResourceId,
  extractResourceLabel,
  isPersistedResourceId,
} from './audit-log-resource-label.util';

export interface ResolveAuditResourceLabelInput {
  resourceType: string | null;
  resourceId: string | null;
  action: AuditLogAction;
  path: string;
  organizationId: string | null;
  responseBody: unknown;
  requestBody: unknown;
}

@Injectable()
export class AuditLogResourceLabelService {
  constructor(
    private readonly resourceLabelRepository: AuditLogResourceLabelRepository,
  ) {}

  async resolveLabel(
    input: ResolveAuditResourceLabelInput,
  ): Promise<string | null> {
    const fromPayload = extractResourceLabel(
      input.resourceType,
      input.responseBody,
      input.requestBody,
    );

    if (fromPayload) {
      return fromPayload;
    }

    const parentResourceId = extractParentResourceId(input.path);
    if (parentResourceId) {
      const parentLabel = await this.lookupProspectOrGeneric(
        input.path,
        parentResourceId,
        input.organizationId,
      );
      if (parentLabel) {
        return parentLabel;
      }
    }

    if (!input.resourceId || !isPersistedResourceId(input.resourceId)) {
      return null;
    }

    return this.lookupByResourceType(
      input.resourceType,
      input.resourceId,
      input.organizationId,
    );
  }

  private async lookupProspectOrGeneric(
    path: string,
    resourceId: string,
    organizationId: string | null,
  ): Promise<string | null> {
    if (path.startsWith('/prospects/')) {
      return this.resourceLabelRepository.findProspectLabel(
        resourceId,
        organizationId,
      );
    }

    return this.lookupByResourceType(null, resourceId, organizationId);
  }

  private lookupByResourceType(
    resourceType: string | null,
    resourceId: string,
    organizationId: string | null,
  ): Promise<string | null> {
    switch (resourceType) {
      case 'prospect':
        return this.resourceLabelRepository.findProspectLabel(
          resourceId,
          organizationId,
        );
      case 'company':
        return this.resourceLabelRepository.findCompanyLabel(
          resourceId,
          organizationId,
        );
      case 'role':
        return this.resourceLabelRepository.findRoleLabel(resourceId);
      case 'abac_policy':
        return this.resourceLabelRepository.findNamedRowLabel(
          'abac_policies',
          resourceId,
          organizationId,
          'name',
        );
      case 'email_campaign':
        return this.resourceLabelRepository.findNamedRowLabel(
          'email_campaigns',
          resourceId,
          organizationId,
          'name',
        );
      case 'mailbox':
        return this.resourceLabelRepository.findMailboxLabel(
          resourceId,
          organizationId,
        );
      case 'contact_list':
        return this.resourceLabelRepository.findNamedRowLabel(
          'contact_lists',
          resourceId,
          organizationId,
          'name',
        );
      case 'manual_list':
        return this.resourceLabelRepository.findNamedRowLabel(
          'manual_lists',
          resourceId,
          organizationId,
          'name',
        );
      case 'email_template':
        return this.resourceLabelRepository.findNamedRowLabel(
          'email_templates',
          resourceId,
          organizationId,
          'name',
        );
      case 'meeting':
        return this.resourceLabelRepository.findMeetingLabel(
          resourceId,
          organizationId,
        );
      case 'company_config':
        return this.resourceLabelRepository.findNamedRowLabel(
          'company_config_options',
          resourceId,
          organizationId,
          'label',
        );
      case 'email_config':
        return this.resourceLabelRepository.findNamedRowLabel(
          'email_config_options',
          resourceId,
          organizationId,
          'label',
        );
      case 'team_member':
        return this.resourceLabelRepository.findUserLabel(resourceId);
      case 'invitation':
        return this.resourceLabelRepository.findNamedRowLabel(
          'invitations',
          resourceId,
          organizationId,
          'email',
        );
      default:
        return Promise.resolve(null);
    }
  }
}
