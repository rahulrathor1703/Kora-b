import { Injectable } from '@nestjs/common';
import type { FieldStoredValue } from '../../common/location/location-field.types';
import { ProspectEngagementEntity } from '../entities/prospect-engagement.entity';
import { ProspectFieldSchemaEntity } from '../entities/prospect-field-schema.entity';
import { ProspectEntity } from '../entities/prospect.entity';
import type { ProspectFieldDefinition } from '../types/prospect-field-schema';

export interface ProspectFieldSchemaResponse {
  fields: ProspectFieldDefinition[];
  fieldKeysInUse: string[];
  updatedAt: string;
}

export interface ProspectResponse {
  id: string;
  fullName: string;
  email: string;
  values: Record<string, FieldStoredValue>;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectsPageResponse {
  items: ProspectResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ProspectSearchResultResponse {
  id: string;
  fullName: string;
  email: string;
}

export interface ProspectEngagementResponse {
  id: string;
  prospectId: string;
  type: string;
  discussion: string;
  outcome: string;
  nextStep: string | null;
  createdAt: string;
  createdByName: string;
  createdByEmail: string;
  fromStageValue: string | null;
  toStageValue: string | null;
  fromStageLabel: string | null;
  toStageLabel: string | null;
}

export interface PipelineStageSummary {
  value: string;
  label: string;
  color?: string;
  count: number;
}

export interface PipelineSummaryResponse {
  stages: PipelineStageSummary[];
}

@Injectable()
export class ProspectMapper {
  toFieldSchemaResponse(
    entity: ProspectFieldSchemaEntity,
    fieldKeysInUse: string[] = [],
  ): ProspectFieldSchemaResponse {
    const fields = [...entity.fields].sort(
      (left, right) => left.sortOrder - right.sortOrder,
    );

    return {
      fields,
      fieldKeysInUse,
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toProspectResponse(entity: ProspectEntity): ProspectResponse {
    return {
      id: entity.id,
      fullName: entity.fullName,
      email: entity.email,
      values: entity.values,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toProspectsPageResponse(
    items: ProspectEntity[],
    total: number,
    page: number,
    pageSize: number,
  ): ProspectsPageResponse {
    return {
      items: items.map((item) => this.toProspectResponse(item)),
      total,
      page,
      pageSize,
    };
  }

  toSearchResult(entity: ProspectEntity): ProspectSearchResultResponse {
    return {
      id: entity.id,
      fullName: entity.fullName,
      email: entity.email,
    };
  }

  toEngagementResponse(
    entity: ProspectEngagementEntity,
  ): ProspectEngagementResponse {
    return {
      id: entity.id,
      prospectId: entity.prospectId,
      type: entity.type,
      discussion: entity.discussion,
      outcome: entity.outcome,
      nextStep: entity.nextStep,
      createdAt: entity.createdAt.toISOString(),
      createdByName: this.formatUserName(entity.createdBy),
      createdByEmail: entity.createdBy?.email ?? '',
      fromStageValue: entity.fromStageValue,
      toStageValue: entity.toStageValue,
      fromStageLabel: entity.fromStageLabel,
      toStageLabel: entity.toStageLabel,
    };
  }

  toEngagementResponseList(
    entities: ProspectEngagementEntity[],
  ): ProspectEngagementResponse[] {
    return entities.map((entity) => this.toEngagementResponse(entity));
  }

  private formatUserName(
    user?: { username: string | null; email: string } | null,
  ): string {
    if (!user) {
      return 'Unknown user';
    }

    if (user.username?.trim()) {
      return user.username.trim();
    }

    return user.email;
  }
}
