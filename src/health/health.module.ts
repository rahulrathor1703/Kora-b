import { DynamicModule, Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthRepository } from './health.repository';
import { HEALTH_REPOSITORY } from './health.repository.port';
import { HealthRepositoryStub } from './health.repository.stub';
import { HealthService } from './health.service';

@Module({})
export class HealthModule {
  static register(databaseEnabled: boolean): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: HEALTH_REPOSITORY,
          useClass: databaseEnabled ? HealthRepository : HealthRepositoryStub,
        },
      ],
    };
  }
}
