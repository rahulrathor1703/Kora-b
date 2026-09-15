export interface HealthRepositoryPort {
  pingDatabase(): Promise<void>;
}

export const HEALTH_REPOSITORY = Symbol('HEALTH_REPOSITORY');
