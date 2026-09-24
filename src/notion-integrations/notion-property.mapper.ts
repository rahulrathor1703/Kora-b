export type NotionSuggestedFieldType =
  'text' | 'email' | 'phone' | 'number' | 'date' | 'select' | 'multiselect';

export interface NotionPropertyValue {
  id: string;
  type: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  email?: string | null;
  phone_number?: string | null;
  url?: string | null;
  number?: number | null;
  checkbox?: boolean;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  date?: { start?: string | null } | null;
  unique_id?: { prefix?: string | null; number?: number | null };
}

export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: string;
  select?: { options?: Array<{ name?: string }> };
  multi_select?: { options?: Array<{ name?: string }> };
  status?: { options?: Array<{ name?: string }> };
}

export interface DescribedNotionProperty {
  id: string;
  name: string;
  notionType: string;
  supported: boolean;
  suggestedFieldType: NotionSuggestedFieldType | null;
  options?: Array<{ value: string; label: string }>;
}

export interface NotionPageLike {
  properties: Record<string, NotionPropertyValue>;
}

const SUPPORTED_TYPE_MAP: Record<string, NotionSuggestedFieldType> = {
  title: 'text',
  rich_text: 'text',
  email: 'email',
  phone_number: 'phone',
  url: 'text',
  number: 'number',
  date: 'date',
  select: 'select',
  status: 'select',
  multi_select: 'multiselect',
  checkbox: 'select',
};

function joinPlainText(
  parts: Array<{ plain_text?: string }> | undefined,
): string {
  return (parts ?? [])
    .map((part) => part.plain_text ?? '')
    .join('')
    .trim();
}

function slugifyOption(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function flattenNotionPropertyValue(
  property: NotionPropertyValue,
): string {
  switch (property.type) {
    case 'title':
      return joinPlainText(property.title);
    case 'rich_text':
      return joinPlainText(property.rich_text);
    case 'email':
      return property.email?.trim() ?? '';
    case 'phone_number':
      return property.phone_number?.trim() ?? '';
    case 'url':
      return property.url?.trim() ?? '';
    case 'number':
      return property.number == null ? '' : String(property.number);
    case 'checkbox':
      return property.checkbox ? 'Yes' : 'No';
    case 'select':
      return property.select?.name?.trim() ?? '';
    case 'status':
      return property.status?.name?.trim() ?? '';
    case 'multi_select':
      return (property.multi_select ?? [])
        .map((option) => option.name?.trim() ?? '')
        .filter(Boolean)
        .join(', ');
    case 'date':
      return property.date?.start?.trim() ?? '';
    case 'unique_id': {
      const prefix = property.unique_id?.prefix?.trim();
      const number = property.unique_id?.number;
      if (number == null) {
        return '';
      }
      return prefix ? `${prefix}-${number}` : String(number);
    }
    default:
      return '';
  }
}

export function describeNotionProperty(
  property: NotionDatabaseProperty,
): DescribedNotionProperty {
  const suggestedFieldType = SUPPORTED_TYPE_MAP[property.type] ?? null;
  const optionSource =
    property.select?.options ??
    property.multi_select?.options ??
    property.status?.options ??
    (property.type === 'checkbox'
      ? [{ name: 'Yes' }, { name: 'No' }]
      : undefined);

  return {
    id: property.id,
    name: property.name,
    notionType: property.type,
    supported: suggestedFieldType !== null,
    suggestedFieldType,
    options: optionSource
      ?.map((option) => {
        const label = option.name?.trim() ?? '';
        return {
          value: slugifyOption(label) || label,
          label,
        };
      })
      .filter((option) => option.label.length > 0),
  };
}

export function flattenNotionPage(
  page: NotionPageLike,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(page.properties).map(([name, property]) => [
      name,
      flattenNotionPropertyValue(property),
    ]),
  );
}
