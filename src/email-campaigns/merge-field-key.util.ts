export function normalizeMergeFieldKey(key: string, label: string): string {
  if (/^email$/i.test(key) || /^email$/i.test(label)) {
    return 'email';
  }

  if (/first.?name/i.test(key) || /first.?name/i.test(label)) {
    return 'first_name';
  }

  if (/last.?name/i.test(key) || /last.?name/i.test(label)) {
    return 'last_name';
  }

  if (/full.?name/i.test(key) || /full.?name/i.test(label)) {
    return 'full_name';
  }

  if (/^company$/i.test(key) || /^company$/i.test(label)) {
    return 'company';
  }

  if (/^role$/i.test(key) || /^role$/i.test(label)) {
    return 'role';
  }

  if (/^city$/i.test(key) || /^city$/i.test(label)) {
    return 'city';
  }

  if (/^country$/i.test(key) || /^country$/i.test(label)) {
    return 'country';
  }

  if (/^phone$/i.test(key) || /^phone$/i.test(label)) {
    return 'phone';
  }

  return key;
}

export const MERGE_FIELD_STANDARD_LABELS: Record<string, string> = {
  email: 'Email',
  first_name: 'First Name',
  last_name: 'Last Name',
  full_name: 'Full Name',
  company: 'Company',
  role: 'Role',
  city: 'City',
  country: 'Country',
  phone: 'Phone',
  sender_name: 'Sender Name',
  unsubscribe: 'Unsubscribe',
};

export type MergeFieldGroupId =
  'name' | 'contact' | 'company' | 'location' | 'custom' | 'system';

const TOKEN_GROUP_MAP: Record<string, MergeFieldGroupId> = {
  first_name: 'name',
  last_name: 'name',
  full_name: 'name',
  email: 'contact',
  phone: 'contact',
  company: 'company',
  role: 'company',
  city: 'location',
  country: 'location',
  sender_name: 'system',
  unsubscribe: 'system',
};

export function resolveMergeFieldGroupId(token: string): MergeFieldGroupId {
  return TOKEN_GROUP_MAP[token] ?? 'custom';
}

export const MERGE_FIELD_GROUP_LABELS: Record<MergeFieldGroupId, string> = {
  name: 'Name',
  contact: 'Contact',
  company: 'Company',
  location: 'Location',
  custom: 'Custom',
  system: 'System',
};
