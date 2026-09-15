import { AsyncLocalStorage } from 'async_hooks';

export interface OrganizationContextStore {
  organizationId: string | null;
  isSuperAdmin: boolean;
}

const organizationStorage = new AsyncLocalStorage<OrganizationContextStore>();

export function runWithOrganizationContext<T>(
  store: OrganizationContextStore,
  fn: () => T,
): T {
  return organizationStorage.run(store, fn);
}

export function getOrganizationContext(): OrganizationContextStore | undefined {
  return organizationStorage.getStore();
}

export function getActiveOrganizationId(): string | null {
  return organizationStorage.getStore()?.organizationId ?? null;
}

export function isSuperAdminContext(): boolean {
  return organizationStorage.getStore()?.isSuperAdmin ?? false;
}
