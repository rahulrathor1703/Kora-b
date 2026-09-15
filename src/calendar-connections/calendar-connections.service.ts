import { Injectable, NotFoundException } from '@nestjs/common';
import { CalendarConnectionsRepository } from './calendar-connections.repository';
import type { CalendarConnectionResponse } from './types/calendar-connection.types';
import type { CalendarConnectionProvider } from './types/calendar-connection.types';

@Injectable()
export class CalendarConnectionsService {
  constructor(private readonly repository: CalendarConnectionsRepository) {}

  async listConnections(userId: string): Promise<CalendarConnectionResponse[]> {
    const connections = await this.repository.findByUserId(userId);

    return connections.map((connection) => ({
      provider: connection.provider,
      email: connection.email,
      connectedAt: connection.connectedAt.toISOString(),
      expiresAt: connection.expiresAt?.toISOString() ?? null,
    }));
  }

  async disconnect(
    userId: string,
    provider: CalendarConnectionProvider,
  ): Promise<void> {
    const connection = await this.repository.findByUserAndProvider(
      userId,
      provider,
    );

    if (!connection) {
      throw new NotFoundException('Calendar connection not found');
    }

    await this.repository.deleteByUserAndProvider(userId, provider);
  }
}
