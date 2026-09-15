import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthRepositoryStub {
  pingDatabase(): Promise<void> {
    return Promise.reject(
      new Error(
        'Database is not connected (SKIP_DB=true or Postgres unavailable)',
      ),
    );
  }
}
