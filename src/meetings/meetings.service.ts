import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { CalendarConnectionsRepository } from '../calendar-connections/calendar-connections.repository';
import { ProspectsRepository } from '../prospects/prospects.repository';
import type {
  CreateMeetingDto,
  MeetingsCalendarQueryDto,
  MeetingsQueryDto,
} from './dto/meeting.dto';
import { MeetingEntity } from './entities/meeting.entity';
import { MeetingCalendarSyncService } from './meeting-calendar-sync.service';
import {
  MeetingMapper,
  type MeetingCalendarResponse,
  type MeetingResponse,
  type MeetingsPageResponse,
  type MeetingsSummaryResponse,
} from './mappers/meeting.mapper';
import { MeetingsRepository } from './meetings.repository';

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class MeetingsService {
  constructor(
    private readonly meetingsRepository: MeetingsRepository,
    private readonly prospectsRepository: ProspectsRepository,
    private readonly meetingMapper: MeetingMapper,
    private readonly meetingCalendarSyncService: MeetingCalendarSyncService,
    private readonly calendarConnectionsRepository: CalendarConnectionsRepository,
  ) {}

  async findMeetings(
    query: MeetingsQueryDto,
    organizationId: string | null,
  ): Promise<MeetingsPageResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const page = query.page ?? 1;
    const pageSize = Math.min(query.pageSize ?? 25, 100);

    const result = await this.meetingsRepository.findPaginated(
      resolvedOrganizationId,
      {
        status: query.status,
        q: query.q,
        page,
        pageSize,
      },
    );

    const items = result.items.map((meeting) => {
      if (!meeting.prospect) {
        throw new NotFoundException('Prospect not found for meeting');
      }

      return { meeting, prospect: meeting.prospect };
    });

    return this.meetingMapper.toPageResponse(
      items,
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async findCalendarMeetings(
    query: MeetingsCalendarQueryDto,
    organizationId: string | null,
  ): Promise<MeetingCalendarResponse[]> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid calendar date range');
    }

    if (to <= from) {
      throw new BadRequestException('Calendar range end must be after start');
    }

    const meetings = await this.meetingsRepository.findInRange(
      resolvedOrganizationId,
      from,
      to,
    );

    return meetings
      .filter(
        (
          meeting,
        ): meeting is MeetingEntity & {
          prospect: NonNullable<MeetingEntity['prospect']>;
        } => Boolean(meeting.prospect),
      )
      .map((meeting) =>
        this.meetingMapper.toCalendarResponse(meeting, meeting.prospect),
      );
  }

  async getSummary(
    organizationId: string | null,
  ): Promise<MeetingsSummaryResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    return this.meetingsRepository.getSummaryCounts(resolvedOrganizationId);
  }

  async create(
    dto: CreateMeetingDto,
    organizationId: string | null,
    createdById: string | null,
  ): Promise<MeetingResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    if (!createdById) {
      throw new BadRequestException('Authenticated user is required');
    }

    const connection =
      await this.calendarConnectionsRepository.findByUserAndProvider(
        createdById,
        dto.platform,
      );
    if (!connection) {
      throw new BadRequestException(
        `Connect your ${dto.platform} account before scheduling meetings`,
      );
    }

    const prospect = await this.prospectsRepository.findProspectById(
      dto.prospectId,
      resolvedOrganizationId,
    );

    if (!prospect) {
      throw new NotFoundException('Prospect not found');
    }

    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    this.validateScheduleWindow(startAt, endAt);

    const prospectName =
      prospect.fullName.trim() || prospect.email || 'prospect';
    const title = dto.title?.trim() || `Meeting with ${prospectName}`;
    const timeZone = dto.timeZone?.trim() || 'UTC';

    const providerResult =
      await this.meetingCalendarSyncService.createProviderMeeting(
        createdById,
        dto.platform,
        {
          title,
          description: dto.description ?? null,
          agenda: dto.agenda ?? null,
          startAt,
          endAt,
          attendeeEmail: prospect.email,
          attendeeName: prospectName,
          timeZone,
        },
      );

    const meeting = this.meetingsRepository.create({
      organizationId: resolvedOrganizationId,
      prospectId: dto.prospectId,
      platform: dto.platform,
      status: 'scheduled',
      title,
      description: dto.description?.trim() || null,
      agenda: dto.agenda?.trim() || null,
      startAt,
      endAt,
      meetingUrl: providerResult.meetingUrl,
      externalEventId: providerResult.externalEventId,
      createdById,
    });

    const saved = await this.meetingsRepository.save(meeting);
    return this.meetingMapper.toResponse(saved, prospect);
  }

  async cancel(
    id: string,
    organizationId: string | null,
    userId: string | null,
  ): Promise<MeetingResponse> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);
    const meeting = await this.requireMeeting(id, resolvedOrganizationId);

    if (meeting.status === 'cancelled') {
      throw new BadRequestException('Meeting is already cancelled');
    }

    if (meeting.status === 'completed') {
      throw new BadRequestException('Completed meetings cannot be cancelled');
    }

    if (
      meeting.externalEventId &&
      meeting.createdById &&
      userId &&
      meeting.createdById === userId
    ) {
      await this.meetingCalendarSyncService.deleteProviderMeeting(
        meeting.createdById,
        meeting.platform,
        meeting.externalEventId,
      );
    }

    meeting.status = 'cancelled';
    const saved = await this.meetingsRepository.save(meeting);

    if (!meeting.prospect) {
      throw new NotFoundException('Prospect not found for meeting');
    }

    return this.meetingMapper.toResponse(saved, meeting.prospect);
  }

  private validateScheduleWindow(startAt: Date, endAt: Date): void {
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid meeting start or end time');
    }

    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException(
        'Meeting end time must be after start time',
      );
    }

    const durationMs = endAt.getTime() - startAt.getTime();
    if (durationMs < MIN_DURATION_MS) {
      throw new BadRequestException('Meeting must be at least 15 minutes long');
    }

    if (durationMs > MAX_DURATION_MS) {
      throw new BadRequestException('Meeting cannot be longer than 8 hours');
    }

    if (startAt.getTime() < Date.now()) {
      throw new BadRequestException('Meeting cannot be scheduled in the past');
    }
  }

  private async requireMeeting(
    id: string,
    organizationId: string,
  ): Promise<MeetingEntity> {
    const meeting = await this.meetingsRepository.findById(id, organizationId);

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }
}
