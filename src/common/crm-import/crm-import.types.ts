import type { LocationComponent } from '../location/location-field.types';

export interface CrmImportFieldDescriptor {
  key: string;
  label: string;
  type: string;
  required: boolean;
  locationComponents?: LocationComponent[];
}

export interface CrmImportRowError {
  row: number;
  key: string;
  message: string;
}

export type CrmImportDuplicateMode = 'fail' | 'skip';

export interface CrmImportResult {
  created: number;
  failed: number;
  skipped: number;
  errors: CrmImportRowError[];
}

export interface CrmImportPreviewResult {
  columns: string[];
  sampleRows: Record<string, string>[];
  rowCount: number;
  importableFields: CrmImportFieldDescriptor[];
  suggestedMapping: Record<string, string>;
  rowIssues?: CrmImportRowError[];
}

export interface CrmImportPayload {
  fieldMapping: Record<string, string>;
}
