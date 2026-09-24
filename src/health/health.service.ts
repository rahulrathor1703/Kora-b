import { Inject, Injectable } from '@nestjs/common';
import {
  HEALTH_REPOSITORY,
  type HealthRepositoryPort,
} from './health.repository.port';

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_REPOSITORY)
    private readonly healthRepository: HealthRepositoryPort,
  ) {}

  async getHealth(): Promise<{
    status: 'ok' | 'degraded';
    service: string;
    timestamp: string;
    checks: { database: 'ok' | 'error' };
  }> {
    let database: 'ok' | 'error' = 'error';

    try {
      await this.healthRepository.pingDatabase();
      database = 'ok';
    } catch {
      database = 'error';
    }

    return {
      status: database === 'ok' ? 'ok' : 'degraded',
      service: 'markos-backend',
      timestamp: new Date().toISOString(),
      checks: { database },
    };
  }
}
