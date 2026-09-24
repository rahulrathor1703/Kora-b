export interface ProspectImportRow {
  email: string;
  fullName?: string;
  phone?: string;
  designation?: string;
}

export interface ProspectSyncResult {
  created: number;
  skipped: number;
  failed: number;
}

export interface ProspectFieldMapping {
  emailColumnKey: string;
  nameColumnKey?: string;
}

export interface ContactListMemberForSync {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
}

export interface ManualListColumnForSync {
  key: string;
  label: string;
}
