import { Injectable } from '@nestjs/common';
import type { FieldStoredValue } from '../../common/location/location-field.types';
import { ProspectEntity } from '../../prospects/entities/prospect.entity';
import { MeetingEntity } from '../entities/meeting.entity';

export interface MeetingProspectSummary {
  id: string;
  name: string;
  email: string;
  designation?: string;
  product?: string;
}

export interface MeetingResponse {
  id: string;
  prospectId: string;
  platform: MeetingEntity['platform'];
  status: MeetingEntity['status'];
  title: string | null;
  startAt: string | null;
  endAt: string | null;
  description: string | null;
  agenda: string | null;
  meetingUrl: string | null;
  createdAt: string;
  prospect: MeetingProspectSummary;
}

export interface MeetingCalendarResponse {
  id: string;
  title: string | null;
  platform: MeetingEntity['platform'];
  status: MeetingEntity['status'];
  startAt: string;
  endAt: string;
  meetingUrl: string | null;
  prospect: MeetingProspectSummary;
}

export interface MeetingsPageResponse {
  items: MeetingResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MeetingsSummaryResponse {
  total: number;
  upcoming: number;
  past: number;
  cancelled: number;
}

@Injectable()
export class MeetingMapper {
  toResponse(entity: MeetingEntity, prospect: ProspectEntity): MeetingResponse {
    return {
      id: entity.id,
      prospectId: entity.prospectId,
      platform: entity.platform,
      status: entity.status,
      title: entity.title,
      startAt: entity.startAt?.toISOString() ?? null,
      endAt: entity.endAt?.toISOString() ?? null,
      description: entity.description,
      agenda: entity.agenda,
      meetingUrl: entity.meetingUrl,
      createdAt: entity.createdAt.toISOString(),
      prospect: this.toProspectSummary(prospect),
    };
  }

  toCalendarResponse(
    entity: MeetingEntity,
    prospect: ProspectEntity,
  ): MeetingCalendarResponse {
    return {
      id: entity.id,
      title: entity.title,
      platform: entity.platform,
      status: entity.status,
      startAt: entity.startAt!.toISOString(),
      endAt: entity.endAt!.toISOString(),
      meetingUrl: entity.meetingUrl,
      prospect: this.toProspectSummary(prospect),
    };
  }

  toPageResponse(
    items: Array<{ meeting: MeetingEntity; prospect: ProspectEntity }>,
    total: number,
    page: number,
    pageSize: number,
  ): MeetingsPageResponse {
    return {
      items: items.map(({ meeting, prospect }) =>
        this.toResponse(meeting, prospect),
      ),
      total,
      page,
      pageSize,
    };
  }

  private toProspectSummary(prospect: ProspectEntity): MeetingProspectSummary {
    const designation = this.readStringValue(prospect.values.designation);
    const product = this.readProductValue(prospect.values.product);

    return {
      id: prospect.id,
      name: prospect.fullName.trim() || prospect.email || 'Unknown prospect',
      email: prospect.email,
      designation: designation || undefined,
      product: product || undefined,
    };
  }

  private readStringValue(value: FieldStoredValue | undefined): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readProductValue(value: FieldStoredValue | undefined): string | null {
    if (typeof value === 'string') {
      return this.readStringValue(value);
    }

    if (Array.isArray(value)) {
      const labels = value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      return labels.length > 0 ? labels.join(', ') : null;
    }

    return null;
  }
}
