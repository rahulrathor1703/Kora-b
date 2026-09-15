export const RESERVED_ORGANIZATION_SLUGS = new Set([
  'admin',
  'api',
  'health',
  'login',
  'platform',
  'signup',
  'workspace',
]);

export function slugifyOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function isReservedOrganizationSlug(slug: string): boolean {
  return RESERVED_ORGANIZATION_SLUGS.has(slug.toLowerCase());
}

export function normalizeOrganizationSlug(slug: string): string {
  return slugifyOrganizationName(slug);
}
