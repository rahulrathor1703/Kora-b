import type { AuditLogAction, AuditLogModule } from './audit-log.types';
import { injectResourceLabelIntoMessage } from './audit-log-resource-label.util';

interface RouteRule {
  method: string;
  pattern: RegExp;
  module: AuditLogModule;
  action: AuditLogAction;
  resourceType?: string;
  message: (actorName: string, params: Record<string, string>) => string;
}

interface ResolvedAuditMessage {
  module: AuditLogModule;
  action: AuditLogAction;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
}

const ROUTE_RULES: RouteRule[] = [
  {
    method: 'POST',
    pattern: /^\/auth\/login$/,
    module: 'access',
    action: 'login',
    message: (actor) => `${actor} signed in`,
  },
  {
    method: 'POST',
    pattern: /^\/auth\/logout$/,
    module: 'access',
    action: 'logout',
    message: (actor) => `${actor} signed out`,
  },
  {
    method: 'GET',
    pattern: /^\/auth\/me$/,
    module: 'access',
    action: 'read',
    message: (actor) => `${actor} viewed their account profile`,
  },
  {
    method: 'GET',
    pattern: /^\/users$/,
    module: 'access',
    action: 'read',
    resourceType: 'team',
    message: (actor) => `${actor} viewed team members`,
  },
  {
    method: 'PATCH',
    pattern: /^\/users\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'update',
    resourceType: 'team_member',
    message: (actor) => `${actor} updated a team member`,
  },
  {
    method: 'PATCH',
    pattern: /^\/users\/(?<id>[^/]+)\/status$/,
    module: 'access',
    action: 'update',
    resourceType: 'team_member',
    message: (actor) => `${actor} changed a team member's status`,
  },
  {
    method: 'GET',
    pattern: /^\/users\/(?<id>[^/]+)\/abac-policies$/,
    module: 'access',
    action: 'read',
    resourceType: 'team_member',
    message: (actor) => `${actor} viewed ABAC policies for a team member`,
  },
  {
    method: 'PUT',
    pattern: /^\/users\/(?<id>[^/]+)\/abac-policies$/,
    module: 'access',
    action: 'update',
    resourceType: 'team_member',
    message: (actor) => `${actor} updated ABAC policies for a team member`,
  },
  {
    method: 'GET',
    pattern: /^\/invitations$/,
    module: 'access',
    action: 'read',
    resourceType: 'invitation',
    message: (actor) => `${actor} viewed pending invitations`,
  },
  {
    method: 'POST',
    pattern: /^\/invitations$/,
    module: 'access',
    action: 'create',
    resourceType: 'invitation',
    message: (actor) => `${actor} invited a team member`,
  },
  {
    method: 'DELETE',
    pattern: /^\/invitations\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'delete',
    resourceType: 'invitation',
    message: (actor) => `${actor} revoked an invitation`,
  },
  {
    method: 'GET',
    pattern: /^\/roles$/,
    module: 'access',
    action: 'read',
    resourceType: 'role',
    message: (actor) => `${actor} viewed roles`,
  },
  {
    method: 'GET',
    pattern: /^\/roles\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'read',
    resourceType: 'role',
    message: (actor) => `${actor} viewed a role`,
  },
  {
    method: 'POST',
    pattern: /^\/roles$/,
    module: 'access',
    action: 'create',
    resourceType: 'role',
    message: (actor) => `${actor} created a role`,
  },
  {
    method: 'PATCH',
    pattern: /^\/roles\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'update',
    resourceType: 'role',
    message: (actor) => `${actor} updated a role`,
  },
  {
    method: 'DELETE',
    pattern: /^\/roles\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'delete',
    resourceType: 'role',
    message: (actor) => `${actor} deleted a role`,
  },
  {
    method: 'GET',
    pattern: /^\/permissions$/,
    module: 'access',
    action: 'read',
    resourceType: 'permission',
    message: (actor) => `${actor} viewed permissions`,
  },
  {
    method: 'GET',
    pattern: /^\/abac-policies$/,
    module: 'access',
    action: 'read',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} viewed ABAC policies`,
  },
  {
    method: 'GET',
    pattern: /^\/abac-policies\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'read',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} viewed an ABAC policy`,
  },
  {
    method: 'POST',
    pattern: /^\/abac-policies$/,
    module: 'access',
    action: 'create',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} created an ABAC policy`,
  },
  {
    method: 'POST',
    pattern: /^\/abac-policies\/bulk-assign$/,
    module: 'access',
    action: 'update',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} bulk-assigned ABAC policies`,
  },
  {
    method: 'PATCH',
    pattern: /^\/abac-policies\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'update',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} updated an ABAC policy`,
  },
  {
    method: 'DELETE',
    pattern: /^\/abac-policies\/(?<id>[^/]+)$/,
    module: 'access',
    action: 'delete',
    resourceType: 'abac_policy',
    message: (actor) => `${actor} deleted an ABAC policy`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} viewed the prospects list`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/search$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} searched prospects`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/followups$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} viewed follow-ups`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/pipeline\/summary$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} viewed pipeline summary`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/field-schema$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_field_schema',
    message: (actor) => `${actor} viewed prospect field schema`,
  },
  {
    method: 'PUT',
    pattern: /^\/prospects\/field-schema$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect_field_schema',
    message: (actor) => `${actor} updated prospect field schema`,
  },
  {
    method: 'POST',
    pattern: /^\/prospects\/import\/preview$/,
    module: 'crm',
    action: 'import',
    resourceType: 'prospect',
    message: (actor) => `${actor} previewed a prospect import`,
  },
  {
    method: 'POST',
    pattern: /^\/prospects\/import$/,
    module: 'crm',
    action: 'import',
    resourceType: 'prospect',
    message: (actor) => `${actor} imported prospects`,
  },
  {
    method: 'POST',
    pattern: /^\/prospects$/,
    module: 'crm',
    action: 'create',
    resourceType: 'prospect',
    message: (actor) => `${actor} created a prospect`,
  },
  {
    method: 'POST',
    pattern: /^\/prospects\/delete-requests$/,
    module: 'crm',
    action: 'create',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} requested prospect deletion`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/delete-requests$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} viewed prospect delete requests`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/delete-requests\/summary-count$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} viewed prospect delete request summary`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/delete-requests\/pending-count$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} viewed pending prospect delete requests`,
  },
  {
    method: 'PATCH',
    pattern: /^\/prospects\/delete-requests\/(?<id>[^/]+)\/approve$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} approved a prospect delete request`,
  },
  {
    method: 'PATCH',
    pattern: /^\/prospects\/delete-requests\/(?<id>[^/]+)\/reject$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} rejected a prospect delete request`,
  },
  {
    method: 'PATCH',
    pattern: /^\/prospects\/delete-requests\/(?<id>[^/]+)\/cancel$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect_delete_request',
    message: (actor) => `${actor} cancelled a prospect delete request`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} viewed a prospect`,
  },
  {
    method: 'PATCH',
    pattern: /^\/prospects\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect',
    message: (actor) => `${actor} updated a prospect`,
  },
  {
    method: 'DELETE',
    pattern: /^\/prospects\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'delete',
    resourceType: 'prospect',
    message: (actor) => `${actor} deleted a prospect`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/(?<id>[^/]+)\/engagements$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_engagement',
    message: (actor) => `${actor} viewed prospect engagements`,
  },
  {
    method: 'POST',
    pattern: /^\/prospects\/(?<id>[^/]+)\/engagements$/,
    module: 'crm',
    action: 'create',
    resourceType: 'prospect_engagement',
    message: (actor) => `${actor} logged a prospect engagement`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/(?<id>[^/]+)\/bant$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect_bant',
    message: (actor) => `${actor} viewed prospect BANT qualification`,
  },
  {
    method: 'PUT',
    pattern: /^\/prospects\/(?<id>[^/]+)\/bant$/,
    module: 'crm',
    action: 'update',
    resourceType: 'prospect_bant',
    message: (actor) => `${actor} updated prospect BANT qualification`,
  },
  {
    method: 'GET',
    pattern: /^\/prospects\/(?<id>[^/]+)\/campaigns$/,
    module: 'crm',
    action: 'read',
    resourceType: 'prospect',
    message: (actor) => `${actor} viewed prospect campaigns`,
  },
  {
    method: 'GET',
    pattern: /^\/companies$/,
    module: 'crm',
    action: 'read',
    resourceType: 'company',
    message: (actor) => `${actor} viewed companies`,
  },
  {
    method: 'GET',
    pattern: /^\/companies\/field-schema$/,
    module: 'crm',
    action: 'read',
    resourceType: 'company_field_schema',
    message: (actor) => `${actor} viewed company field schema`,
  },
  {
    method: 'PUT',
    pattern: /^\/companies\/field-schema$/,
    module: 'crm',
    action: 'update',
    resourceType: 'company_field_schema',
    message: (actor) => `${actor} updated company field schema`,
  },
  {
    method: 'GET',
    pattern: /^\/companies\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'read',
    resourceType: 'company',
    message: (actor) => `${actor} viewed a company`,
  },
  {
    method: 'POST',
    pattern: /^\/companies$/,
    module: 'crm',
    action: 'create',
    resourceType: 'company',
    message: (actor) => `${actor} created a company`,
  },
  {
    method: 'PATCH',
    pattern: /^\/companies\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'update',
    resourceType: 'company',
    message: (actor) => `${actor} updated a company`,
  },
  {
    method: 'DELETE',
    pattern: /^\/companies\/(?<id>[^/]+)$/,
    module: 'crm',
    action: 'delete',
    resourceType: 'company',
    message: (actor) => `${actor} deleted a company`,
  },
  {
    method: 'POST',
    pattern: /^\/companies\/import$/,
    module: 'crm',
    action: 'import',
    resourceType: 'company',
    message: (actor) => `${actor} imported companies`,
  },
  {
    method: 'GET',
    pattern: /^\/meetings$/,
    module: 'crm',
    action: 'read',
    resourceType: 'meeting',
    message: (actor) => `${actor} viewed meetings`,
  },
  {
    method: 'POST',
    pattern: /^\/meetings$/,
    module: 'crm',
    action: 'create',
    resourceType: 'meeting',
    message: (actor) => `${actor} scheduled a meeting`,
  },
  {
    method: 'GET',
    pattern: /^\/email-campaigns$/,
    module: 'email',
    action: 'read',
    resourceType: 'email_campaign',
    message: (actor) => `${actor} viewed email campaigns`,
  },
  {
    method: 'GET',
    pattern: /^\/email-campaigns\/(?<id>[^/]+)$/,
    module: 'email',
    action: 'read',
    resourceType: 'email_campaign',
    message: (actor) => `${actor} viewed an email campaign`,
  },
  {
    method: 'POST',
    pattern: /^\/email-campaigns$/,
    module: 'email',
    action: 'create',
    resourceType: 'email_campaign',
    message: (actor) => `${actor} created an email campaign`,
  },
  {
    method: 'PATCH',
    pattern: /^\/email-campaigns\/(?<id>[^/]+)$/,
    module: 'email',
    action: 'update',
    resourceType: 'email_campaign',
    message: (actor) => `${actor} updated an email campaign`,
  },
  {
    method: 'DELETE',
    pattern: /^\/email-campaigns\/(?<id>[^/]+)$/,
    module: 'email',
    action: 'delete',
    resourceType: 'email_campaign',
    message: (actor) => `${actor} deleted an email campaign`,
  },
  {
    method: 'GET',
    pattern: /^\/mailboxes$/,
    module: 'email',
    action: 'read',
    resourceType: 'mailbox',
    message: (actor) => `${actor} viewed mailboxes`,
  },
  {
    method: 'POST',
    pattern: /^\/mailboxes$/,
    module: 'email',
    action: 'create',
    resourceType: 'mailbox',
    message: (actor) => `${actor} added a mailbox`,
  },
  {
    method: 'GET',
    pattern: /^\/contact-lists$/,
    module: 'email',
    action: 'read',
    resourceType: 'contact_list',
    message: (actor) => `${actor} viewed contact lists`,
  },
  {
    method: 'GET',
    pattern: /^\/manual-lists$/,
    module: 'email',
    action: 'read',
    resourceType: 'manual_list',
    message: (actor) => `${actor} viewed manual lists`,
  },
  {
    method: 'GET',
    pattern: /^\/email-templates$/,
    module: 'email',
    action: 'read',
    resourceType: 'email_template',
    message: (actor) => `${actor} viewed email templates`,
  },
  {
    method: 'GET',
    pattern: /^\/bant-settings$/,
    module: 'settings',
    action: 'read',
    resourceType: 'bant_settings',
    message: (actor) => `${actor} viewed BANT settings`,
  },
  {
    method: 'PUT',
    pattern: /^\/bant-settings$/,
    module: 'settings',
    action: 'update',
    resourceType: 'bant_settings',
    message: (actor) => `${actor} updated BANT settings`,
  },
  {
    method: 'GET',
    pattern: /^\/company-config$/,
    module: 'settings',
    action: 'read',
    resourceType: 'company_config',
    message: (actor) => `${actor} viewed company configuration options`,
  },
  {
    method: 'GET',
    pattern: /^\/location-settings$/,
    module: 'settings',
    action: 'read',
    resourceType: 'location_settings',
    message: (actor) => `${actor} viewed location API settings`,
  },
  {
    method: 'PUT',
    pattern: /^\/location-settings$/,
    module: 'settings',
    action: 'update',
    resourceType: 'location_settings',
    message: (actor) => `${actor} updated location API settings`,
  },
  {
    method: 'GET',
    pattern: /^\/email-config$/,
    module: 'settings',
    action: 'read',
    resourceType: 'email_config',
    message: (actor) => `${actor} viewed email configuration options`,
  },
  {
    method: 'GET',
    pattern: /^\/table-preferences\/(?<tableName>[^/]+)\/effective$/,
    module: 'settings',
    action: 'read',
    resourceType: 'table_preference',
    message: (actor) => `${actor} viewed table column preferences`,
  },
  {
    method: 'GET',
    pattern: /^\/website\/properties$/,
    module: 'website',
    action: 'read',
    resourceType: 'website_property',
    message: (actor) => `${actor} viewed website properties`,
  },
  {
    method: 'GET',
    pattern: /^\/website\/on-page\/audits$/,
    module: 'website',
    action: 'read',
    resourceType: 'seo_audit',
    message: (actor) => `${actor} viewed SEO audit runs`,
  },
  {
    method: 'POST',
    pattern: /^\/website\/on-page\/audits\/trigger$/,
    module: 'website',
    action: 'create',
    resourceType: 'seo_audit',
    message: (actor) => `${actor} triggered an SEO audit`,
  },
  {
    method: 'GET',
    pattern: /^\/analytics\/dashboards$/,
    module: 'system',
    action: 'read',
    resourceType: 'analytics_dashboard',
    message: (actor) => `${actor} viewed analytics dashboards`,
  },
  {
    method: 'GET',
    pattern: /^\/platform\/admins$/,
    module: 'platform',
    action: 'read',
    resourceType: 'platform_admin',
    message: (actor) => `${actor} viewed platform organizations`,
  },
];

const MODULE_PREFIXES: Array<{ prefix: string; module: AuditLogModule }> = [
  { prefix: '/prospects', module: 'crm' },
  { prefix: '/companies', module: 'crm' },
  { prefix: '/meetings', module: 'crm' },
  { prefix: '/calendar-connections', module: 'crm' },
  { prefix: '/email-campaigns', module: 'email' },
  { prefix: '/mailboxes', module: 'email' },
  { prefix: '/contact-lists', module: 'email' },
  { prefix: '/manual-lists', module: 'email' },
  { prefix: '/email-templates', module: 'email' },
  { prefix: '/email-config', module: 'email' },
  { prefix: '/email-inbox', module: 'email' },
  { prefix: '/email-excluded', module: 'email' },
  { prefix: '/roles', module: 'access' },
  { prefix: '/permissions', module: 'access' },
  { prefix: '/abac-policies', module: 'access' },
  { prefix: '/users', module: 'access' },
  { prefix: '/invitations', module: 'access' },
  { prefix: '/auth', module: 'access' },
  { prefix: '/bant-settings', module: 'settings' },
  { prefix: '/company-config', module: 'settings' },
  { prefix: '/location-settings', module: 'settings' },
  { prefix: '/location', module: 'settings' },
  { prefix: '/table-preferences', module: 'settings' },
  { prefix: '/website', module: 'website' },
  { prefix: '/analytics', module: 'system' },
  { prefix: '/platform', module: 'platform' },
];

const ACTION_LABELS: Record<AuditLogAction, string> = {
  read: 'viewed',
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  login: 'signed in',
  logout: 'signed out',
  import: 'imported data via',
  other: 'accessed',
};

function resolveModuleFromPath(path: string): AuditLogModule {
  const match = MODULE_PREFIXES.find((entry) => path.startsWith(entry.prefix));
  return match?.module ?? 'system';
}

function resolveActionFromRequest(
  method: string,
  path: string,
): AuditLogAction {
  if (path === '/auth/login') {
    return 'login';
  }

  if (path === '/auth/logout') {
    return 'logout';
  }

  if (path.includes('/import')) {
    return 'import';
  }

  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'read';
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return 'other';
  }
}

function extractParams(pattern: RegExp, path: string): Record<string, string> {
  const match = pattern.exec(path);
  if (!match?.groups) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(match.groups).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

export function resolveAuditLogMessage(
  method: string,
  path: string,
  actorName: string,
  resourceLabel?: string | null,
): ResolvedAuditMessage {
  const normalizedMethod = method.toUpperCase();

  for (const rule of ROUTE_RULES) {
    if (rule.method !== normalizedMethod) {
      continue;
    }

    const match = rule.pattern.exec(path);
    if (!match) {
      continue;
    }

    const params = extractParams(rule.pattern, path);
    const baseMessage = rule.message(actorName, params);

    return {
      module: rule.module,
      action: rule.action,
      message: injectResourceLabelIntoMessage(
        baseMessage,
        rule.resourceType ?? null,
        resourceLabel,
      ),
      resourceType: rule.resourceType ?? null,
      resourceId: params.id ?? null,
    };
  }

  const module = resolveModuleFromPath(path);
  const action = resolveActionFromRequest(normalizedMethod, path);
  const actionLabel = ACTION_LABELS[action];
  const baseMessage = resourceLabel
    ? `${actorName} ${actionLabel} ${path}: "${resourceLabel}"`
    : `${actorName} ${actionLabel} ${path}`;

  return {
    module,
    action,
    message: baseMessage,
    resourceType: null,
    resourceId: null,
  };
}

export function matchAuditLogRoute(
  method: string,
  path: string,
): Omit<ResolvedAuditMessage, 'message'> | null {
  const normalizedMethod = method.toUpperCase();

  for (const rule of ROUTE_RULES) {
    if (rule.method !== normalizedMethod) {
      continue;
    }

    const match = rule.pattern.exec(path);
    if (!match) {
      continue;
    }

    const params = extractParams(rule.pattern, path);

    return {
      module: rule.module,
      action: rule.action,
      resourceType: rule.resourceType ?? null,
      resourceId: params.id ?? null,
    };
  }

  return null;
}

export function formatActorName(
  username: string | null | undefined,
  email: string,
): string {
  if (username?.trim()) {
    return username.trim();
  }

  const localPart = email.split('@')[0]?.trim();
  return localPart || email;
}

const SENSITIVE_QUERY_KEYS = new Set([
  'password',
  'token',
  'secret',
  'access_token',
  'refresh_token',
  'code',
]);

function isQueryRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeQuery(query: unknown): Record<string, string> {
  const sanitized: Record<string, string> = {};

  if (!isQueryRecord(query)) {
    return sanitized;
  }

  for (const [key, value] of Object.entries(query)) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[redacted]';
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = value;
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = String(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(String).join(',');
    }
  }

  return sanitized;
}

export function shouldSkipAuditLog(
  path: string,
  method: string,
  hasUser: boolean,
): boolean {
  if (path === '/health') {
    return true;
  }

  if (path.startsWith('/track/')) {
    return true;
  }

  if (
    method.toUpperCase() === 'GET' &&
    (path === '/audit-logs' || path === '/platform/audit-logs')
  ) {
    return true;
  }

  if (path.startsWith('/signup/')) {
    return true;
  }

  if (/^\/invitations\/[^/]+\/(validate|accept)$/.test(path)) {
    return true;
  }

  if (path === '/auth/login' || path === '/auth/logout') {
    return false;
  }

  return !hasUser;
}
