import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { MeetingEntity } from './entities/meeting.entity';
import type { MeetingListStatus } from './types/meeting.types';

export interface MeetingsQuery {
  status?: MeetingListStatus;
  q?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedMeetings {
  items: MeetingEntity[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MeetingsSummaryCounts {
  total: number;
  upcoming: number;
  past: number;
  cancelled: number;
}

@Injectable()
export class MeetingsRepository {
  constructor(
    @InjectRepository(MeetingEntity)
    private readonly repository: Repository<MeetingEntity>,
  ) {}

  findById(id: string, organizationId: string): Promise<MeetingEntity | null> {
    return this.repository.findOne({
      where: { id, organizationId },
      relations: { prospect: true },
    });
  }

  create(data: Partial<MeetingEntity>): MeetingEntity {
    return this.repository.create(data);
  }

  save(entity: MeetingEntity): Promise<MeetingEntity> {
    return this.repository.save(entity);
  }

  async findPaginated(
    organizationId: string,
    query: MeetingsQuery,
  ): Promise<PaginatedMeetings> {
    const qb = this.repository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.prospect', 'prospect')
      .where('meeting.organizationId = :organizationId', { organizationId });

    this.applyStatusFilter(qb, query.status);

    if (query.q?.trim()) {
      const search = `%${query.q.trim().toLowerCase()}%`;
      qb.andWhere(
        new Brackets((where) => {
          where
            .where('LOWER(prospect.fullName) LIKE :search', { search })
            .orWhere('LOWER(prospect.email) LIKE :search', { search })
            .orWhere("LOWER(COALESCE(meeting.title, '')) LIKE :search", {
              search,
            });
        }),
      );
    }

    qb.orderBy('meeting.createdAt', 'DESC');

    const total = await qb.getCount();
    const items = await qb
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize)
      .getMany();

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async findInRange(
    organizationId: string,
    from: Date,
    to: Date,
  ): Promise<MeetingEntity[]> {
    return this.repository
      .createQueryBuilder('meeting')
      .leftJoinAndSelect('meeting.prospect', 'prospect')
      .where('meeting.organizationId = :organizationId', { organizationId })
      .andWhere("meeting.status <> 'cancelled'")
      .andWhere('meeting.startAt IS NOT NULL')
      .andWhere('meeting.endAt IS NOT NULL')
      .andWhere('meeting.startAt < :to', { to })
      .andWhere('meeting.endAt > :from', { from })
      .orderBy('meeting.startAt', 'ASC')
      .getMany();
  }

  async getSummaryCounts(
    organizationId: string,
  ): Promise<MeetingsSummaryCounts> {
    const [total, upcoming, past, cancelled] = await Promise.all([
      this.repository.count({ where: { organizationId } }),
      this.repository
        .createQueryBuilder('meeting')
        .where('meeting.organizationId = :organizationId', { organizationId })
        .andWhere("meeting.status = 'scheduled'")
        .andWhere('meeting.startAt IS NOT NULL')
        .andWhere('meeting.startAt > NOW()')
        .getCount(),
      this.repository
        .createQueryBuilder('meeting')
        .where('meeting.organizationId = :organizationId', { organizationId })
        .andWhere(
          new Brackets((where) => {
            where
              .where("meeting.status = 'completed'")
              .orWhere(
                "(meeting.status = 'scheduled' AND meeting.startAt IS NOT NULL AND meeting.startAt <= NOW())",
              );
          }),
        )
        .getCount(),
      this.repository.count({
        where: { organizationId, status: 'cancelled' },
      }),
    ]);

    return { total, upcoming, past, cancelled };
  }

  private applyStatusFilter(
    qb: ReturnType<Repository<MeetingEntity>['createQueryBuilder']>,
    status?: MeetingListStatus,
  ): void {
    if (!status || status === 'all') {
      return;
    }

    switch (status) {
      case 'upcoming':
        qb.andWhere("meeting.status = 'scheduled'")
          .andWhere('meeting.startAt IS NOT NULL')
          .andWhere('meeting.startAt > NOW()');
        break;
      case 'past':
        qb.andWhere(
          new Brackets((where) => {
            where
              .where("meeting.status = 'completed'")
              .orWhere(
                "(meeting.status = 'scheduled' AND meeting.startAt IS NOT NULL AND meeting.startAt <= NOW())",
              );
          }),
        );
        break;
      case 'cancelled':
        qb.andWhere("meeting.status = 'cancelled'");
        break;
      case 'completed':
        qb.andWhere("meeting.status = 'completed'");
        break;
    }
  }
}
