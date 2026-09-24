import { Injectable } from '@nestjs/common';
import type { ManualListColumnDefinition } from '../entities/manual-list.entity';
import type { ManualListRowEntity } from '../entities/manual-list-row.entity';
import type { ManualListEntity } from '../entities/manual-list.entity';

import type {
  LinkedCampaignSummary,
  ListEngagementStats,
} from '../../list-engagement/list-engagement.types';
import type { ProspectSyncResult } from '../../prospects/types/list-prospect-sync.types';

export interface ManualListSummaryResponse {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManualListRowResponse {
  id: string;
  rowIndex: number;
  values: Record<string, string>;
}

export interface ManualListDetailResponse extends ManualListSummaryResponse {
  columns: ManualListColumnDefinition[];
  rows: ManualListRowResponse[];
  stats: ListEngagementStats;
  campaigns: LinkedCampaignSummary[];
}

export interface ManualListCreateResponse extends ManualListDetailResponse {
  prospectSync?: ProspectSyncResult;
}

export interface ManualListAppendResponse {
  list: ManualListSummaryResponse;
  importedCount: number;
  skippedCount: number;
  importedRowIds: string[];
}

export interface ManualListRowRemovalPreviewResponse {
  email: string | null;
  campaignImpacts: Array<{
    campaignId: string;
    campaignName: string;
    status: string;
    recipientId: string;
    contactDisposition: string;
  }>;
}

export interface ManualListRowRemovalResponse {
  removed: boolean;
  campaignResults: Array<{
    campaignId: string;
    success: boolean;
    error?: string;
  }>;
}

export interface ManualListEnrollmentOptionsResponse {
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

export interface ManualListEnrollRowsResponse {
  results: Array<{
    campaignId: string;
    email: string;
    success: boolean;
    error?: string;
  }>;
  addedCount: number;
  skippedCount: number;
}

@Injectable()
export class ManualListMapper {
  toSummary(entity: ManualListEntity): ManualListSummaryResponse {
    return {
      id: entity.id,
      name: entity.name,
      rowCount: entity.rowCount,
      columnCount: entity.columns.length,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toDetail(
    entity: ManualListEntity,
    rows: ManualListRowEntity[],
    stats: ListEngagementStats,
    campaigns: LinkedCampaignSummary[],
  ): ManualListDetailResponse {
    return {
      ...this.toSummary(entity),
      columns: entity.columns,
      rows: rows.map((row) => this.toRowResponse(row)),
      stats,
      campaigns,
    };
  }

  toRowResponse(entity: ManualListRowEntity): ManualListRowResponse {
    return {
      id: entity.id,
      rowIndex: entity.rowIndex,
      values: entity.data,
    };
  }
}
