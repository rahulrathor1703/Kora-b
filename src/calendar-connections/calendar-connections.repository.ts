import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCalendarConnectionEntity } from './entities/user-calendar-connection.entity';
import type { CalendarConnectionProvider } from './types/calendar-connection.types';

@Injectable()
export class CalendarConnectionsRepository {
  constructor(
    @InjectRepository(UserCalendarConnectionEntity)
    private readonly repository: Repository<UserCalendarConnectionEntity>,
  ) {}

  findByUserId(userId: string): Promise<UserCalendarConnectionEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { provider: 'ASC' },
    });
  }

  findByUserAndProvider(
    userId: string,
    provider: CalendarConnectionProvider,
  ): Promise<UserCalendarConnectionEntity | null> {
    return this.repository.findOne({
      where: { userId, provider },
    });
  }

  upsertConnection(
    data: Partial<UserCalendarConnectionEntity>,
  ): Promise<UserCalendarConnectionEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async deleteByUserAndProvider(
    userId: string,
    provider: CalendarConnectionProvider,
  ): Promise<void> {
    await this.repository.delete({ userId, provider });
  }
}
