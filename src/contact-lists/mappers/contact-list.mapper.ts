import { Injectable } from '@nestjs/common';
import type { ContactListMemberEntity } from '../entities/contact-list-member.entity';
import type { ContactListEntity } from '../entities/contact-list.entity';
import type {
  ContactListFieldSchema,
  ContactListFieldDefinition,
} from '../types/contact-list-field-schema';
import { DEFAULT_CONTACT_LIST_FIELD_SCHEMA } from '../types/contact-list-field-schema';
import type {
  LinkedCampaignSummary,
  ListEmailStatus,
  ListEngagementStats,
} from '../../list-engagement/list-engagement.types';
import type { ProspectSyncResult } from '../../prospects/types/list-prospect-sync.types';

export interface ContactListResponse {
  id: string;
  name: string;
  contactCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContactListMemberResponse {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  customFields: Record<string, string>;
  emailStatus: ListEmailStatus;
  createdAt: string;
}

export interface ContactListDetailResponse extends ContactListResponse {
  fieldSchema: ContactListFieldSchema;
  stats: ListEngagementStats;
  campaigns: LinkedCampaignSummary[];
}

export interface ContactListMembersPageResponse {
  items: ContactListMemberResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContactListImportResponse {
  list: ContactListResponse;
  importedCount: number;
  skippedCount: number;
  prospectSync?: ProspectSyncResult;
}

export interface ContactListAppendResponse {
  list: ContactListResponse;
  importedCount: number;
  skippedCount: number;
  importedEmails: string[];
}

export interface ContactListMemberRemovalPreviewResponse {
  email: string;
  campaignImpacts: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    recipientId: string;
    contactDisposition: string;
  }>;
}

export interface ContactListMemberRemovalResponse {
  removed: boolean;
  campaignResults: Array<{
    campaignId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface ContactListEnrollmentOptionsResponse {
  options: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    requiresSchedule: boolean;
    canEnroll: boolean;
    alreadyEnrolled: boolean;
    reason?: string;
  }>;
}

export interface ContactListEnrollMembersResponse {
  results: Array<{
    campaignId: string;
    email: string;
    success: boolean;
    error?: string;
  }>;
  addedCount: number;
  skippedCount: number;
}

const STANDARD_FIELD_LABELS: Record<string, string> = {
  firstName: 'First Name',
  lastName: 'Last Name',
  company: 'Company',
  phone: 'Phone',
};

@Injectable()
export class ContactListMapper {
  toResponse(entity: ContactListEntity): ContactListResponse {
    return {
      id: entity.id,
      name: entity.name,
      contactCount: entity.contactCount,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toDetailResponse(
    entity: ContactListEntity,
    fieldSchema: ContactListFieldSchema,
    stats: ListEngagementStats,
    campaigns: LinkedCampaignSummary[],
  ): ContactListDetailResponse {
    return {
      ...this.toResponse(entity),
      fieldSchema,
      stats,
      campaigns,
    };
  }

  toMemberResponse(
    entity: ContactListMemberEntity,
    emailStatus: ListEmailStatus,
  ): ContactListMemberResponse {
    return {
      id: entity.id,
      email: entity.email,
      firstName: entity.firstName,
      lastName: entity.lastName,
      company: entity.company,
      phone: entity.phone,
      customFields: entity.customFields,
      emailStatus,
      createdAt: entity.createdAt.toISOString(),
    };
  }

  resolveFieldSchema(
    entity: ContactListEntity,
    members: ContactListMemberEntity[],
  ): ContactListFieldSchema {
    if (entity.fieldSchema?.email?.key) {
      return entity.fieldSchema;
    }

    return this.deriveFieldSchemaFromMembers(members);
  }

  deriveFieldSchemaFromMembers(
    members: ContactListMemberEntity[],
  ): ContactListFieldSchema {
    const fields: ContactListFieldDefinition[] = [];
    const fieldKeys = new Set<string>();

    for (const key of ['firstName', 'lastName', 'company', 'phone'] as const) {
      if (members.some((member) => member[key])) {
        fieldKeys.add(key);
        fields.push({
          key,
          label: STANDARD_FIELD_LABELS[key],
        });
      }
    }

    for (const member of members) {
      for (const key of Object.keys(member.customFields ?? {})) {
        if (!fieldKeys.has(key)) {
          fieldKeys.add(key);
          fields.push({ key, label: key });
        }
      }
    }

    return {
      ...DEFAULT_CONTACT_LIST_FIELD_SCHEMA,
      fields,
    };
  }
}
