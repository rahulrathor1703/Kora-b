export interface ContactListFieldDefinition {
  key: string;
  label: string;
}

export interface ContactListFieldSchema {
  email: ContactListFieldDefinition;
  fields: ContactListFieldDefinition[];
}

export const DEFAULT_CONTACT_LIST_FIELD_SCHEMA: ContactListFieldSchema = {
  email: { key: 'email', label: 'Email' },
  fields: [],
};
