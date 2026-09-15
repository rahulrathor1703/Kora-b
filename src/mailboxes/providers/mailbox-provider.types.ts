export interface GmailCredentials {
  type: 'gmail';
  password: string;
  authMethod: 'smtp' | 'oauth';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | null;
}

export interface OutlookCredentials {
  type: 'outlook';
  password: string;
  authMethod: 'smtp' | 'oauth';
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number | null;
}

export interface SmtpCredentials {
  type: 'smtp';
  password: string;
}

export type MailboxCredentials =
  GmailCredentials | OutlookCredentials | SmtpCredentials;

export interface ProviderValidationInput {
  provider: 'gmail' | 'outlook' | 'smtp';
  email?: string;
  appPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
}

export interface ProviderValidationResult {
  email: string;
  credentials: MailboxCredentials;
  syncStatus: 'connected' | 'error';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpSecure?: boolean;
}
