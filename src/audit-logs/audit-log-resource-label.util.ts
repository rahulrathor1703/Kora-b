const MAX_LABEL_LENGTH = 120;

const RESOURCE_LABEL_FIELDS: Record<string, string[]> = {
  prospect: ['fullName', 'email'],
  company: ['brokerName'],
  role: ['name'],
  abac_policy: ['name'],
  team_member: ['username', 'email'],
  invitation: ['email'],
  email_campaign: ['name'],
  mailbox: ['senderEmail', 'email', 'name'],
  contact_list: ['name'],
  manual_list: ['name'],
  email_template: ['name'],
  meeting: ['title', 'prospect.name'],
  company_config: ['label'],
  email_config: ['label'],
  website_property: ['name', 'domain', 'url'],
  analytics_dashboard: ['name', 'title'],
};

const GENERIC_LABEL_FIELDS = [
  'name',
  'title',
  'label',
  'fullName',
  'brokerName',
  'email',
  'subject',
  'senderEmail',
  'senderName',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }

    current = current[part];
  }

  return current;
}

function truncateLabel(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_LABEL_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, MAX_LABEL_LENGTH - 1)}…`;
}

function readStringField(body: unknown, field: string): string | null {
  if (!isRecord(body)) {
    return null;
  }

  const value = field.includes('.') ? getNestedValue(body, field) : body[field];

  if (typeof value === 'string' && value.trim()) {
    return truncateLabel(value);
  }

  return null;
}

function extractFromBody(body: unknown, fields: string[]): string | null {
  for (const field of fields) {
    const value = readStringField(body, field);
    if (value) {
      return value;
    }
  }

  if (isRecord(body) && isRecord(body.user)) {
    for (const field of ['username', 'email', 'name']) {
      const value = readStringField(body.user, field);
      if (value) {
        return value;
      }
    }
  }

  if (isRecord(body) && isRecord(body.prospect)) {
    for (const field of ['name', 'fullName', 'email']) {
      const value = readStringField(body.prospect, field);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

export function extractResourceLabel(
  resourceType: string | null,
  responseBody: unknown,
  requestBody: unknown,
): string | null {
  const typedFields = resourceType
    ? (RESOURCE_LABEL_FIELDS[resourceType] ?? [])
    : [];

  for (const body of [responseBody, requestBody]) {
    if (typedFields.length > 0) {
      const typedLabel = extractFromBody(body, typedFields);
      if (typedLabel) {
        return typedLabel;
      }
    }

    const genericLabel = extractFromBody(body, GENERIC_LABEL_FIELDS);
    if (genericLabel) {
      return genericLabel;
    }
  }

  return null;
}

const ARTICLE_NOUN_REPLACEMENTS: Array<{
  resourceTypes: string[];
  article: 'a' | 'an';
  noun: string;
}> = [
  { resourceTypes: ['prospect'], article: 'a', noun: 'prospect' },
  { resourceTypes: ['company'], article: 'a', noun: 'company' },
  { resourceTypes: ['role'], article: 'a', noun: 'role' },
  { resourceTypes: ['team_member'], article: 'a', noun: 'team member' },
  { resourceTypes: ['invitation'], article: 'an', noun: 'invitation' },
  { resourceTypes: ['abac_policy'], article: 'an', noun: 'ABAC policy' },
  { resourceTypes: ['email_campaign'], article: 'an', noun: 'email campaign' },
  { resourceTypes: ['mailbox'], article: 'a', noun: 'mailbox' },
  { resourceTypes: ['contact_list'], article: 'a', noun: 'contact list' },
  { resourceTypes: ['manual_list'], article: 'a', noun: 'manual list' },
  { resourceTypes: ['email_template'], article: 'an', noun: 'email template' },
  { resourceTypes: ['meeting'], article: 'a', noun: 'meeting' },
  {
    resourceTypes: ['company_config'],
    article: 'a',
    noun: 'company config option',
  },
  {
    resourceTypes: ['email_config'],
    article: 'an',
    noun: 'email config option',
  },
  {
    resourceTypes: ['website_property'],
    article: 'a',
    noun: 'website property',
  },
  { resourceTypes: ['seo_audit'], article: 'an', noun: 'SEO audit' },
  {
    resourceTypes: ['analytics_dashboard'],
    article: 'an',
    noun: 'analytics dashboard',
  },
];

export function injectResourceLabelIntoMessage(
  message: string,
  resourceType: string | null,
  resourceLabel: string | null | undefined,
): string {
  if (!resourceLabel?.trim() || !resourceType) {
    return message;
  }

  const label = resourceLabel.trim();

  if (
    resourceType === 'prospect_engagement' ||
    resourceType === 'prospect_bant'
  ) {
    if (message.includes('prospect ')) {
      return message.replace('prospect ', `prospect "${label}" `);
    }

    return `${message} for prospect "${label}"`;
  }

  const replacement = ARTICLE_NOUN_REPLACEMENTS.find((entry) =>
    entry.resourceTypes.includes(resourceType),
  );

  if (replacement) {
    const withArticle = `${replacement.article} ${replacement.noun}`;
    if (message.includes(withArticle)) {
      return message.replace(withArticle, `${replacement.noun} "${label}"`);
    }

    if (message.includes(replacement.noun)) {
      return message.replace(
        replacement.noun,
        `${replacement.noun} "${label}"`,
      );
    }
  }

  const namedActionReplacements: Array<[string, string]> = [
    ['revoked an invitation', `revoked invitation "${label}"`],
    ['invited a team member', `invited team member "${label}"`],
    ['added a mailbox', `added mailbox "${label}"`],
    ['scheduled a meeting', `scheduled meeting "${label}"`],
    [
      'logged a prospect engagement',
      `logged an engagement for prospect "${label}"`,
    ],
    [
      'viewed prospect engagements',
      `viewed engagements for prospect "${label}"`,
    ],
    [
      'viewed prospect BANT qualification',
      `viewed BANT qualification for prospect "${label}"`,
    ],
    [
      'updated prospect BANT qualification',
      `updated BANT qualification for prospect "${label}"`,
    ],
    ['viewed prospect campaigns', `viewed campaigns for prospect "${label}"`],
  ];

  for (const [pattern, replacement] of namedActionReplacements) {
    if (message.includes(pattern)) {
      return message.replace(pattern, replacement);
    }
  }

  if (message.endsWith(label) || message.includes(`"${label}"`)) {
    return message;
  }

  return `${message}: "${label}"`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedResourceId(value: string): boolean {
  return UUID_PATTERN.test(value);
}

const RESERVED_PARENT_RESOURCE_SEGMENTS = new Set([
  'import',
  'search',
  'field-schema',
  'pipeline',
  'followups',
  'delete-requests',
]);

function isResourceIdCandidate(candidate: string): boolean {
  if (RESERVED_PARENT_RESOURCE_SEGMENTS.has(candidate)) {
    return false;
  }

  return isPersistedResourceId(candidate);
}

export function extractParentResourceId(path: string): string | null {
  const match =
    /^\/prospects\/([^/]+)/.exec(path) ??
    /^\/companies\/([^/]+)/.exec(path) ??
    /^\/email-campaigns\/([^/]+)/.exec(path) ??
    /^\/roles\/([^/]+)/.exec(path) ??
    /^\/contact-lists\/([^/]+)/.exec(path) ??
    /^\/manual-lists\/([^/]+)/.exec(path) ??
    /^\/email-templates\/([^/]+)/.exec(path) ??
    /^\/mailboxes\/([^/]+)/.exec(path) ??
    /^\/meetings\/([^/]+)/.exec(path) ??
    /^\/abac-policies\/([^/]+)/.exec(path) ??
    /^\/company-config\/([^/]+)/.exec(path) ??
    /^\/email-config\/([^/]+)/.exec(path) ??
    /^\/users\/([^/]+)/.exec(path);

  const candidate = match?.[1];
  if (!candidate || !isResourceIdCandidate(candidate)) {
    return null;
  }

  return candidate;
}
