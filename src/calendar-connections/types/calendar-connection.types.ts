export const CALENDAR_CONNECTION_PROVIDERS = [
  'google',
  'outlook',
  'zoom',
] as const;

export type CalendarConnectionProvider =
  (typeof CALENDAR_CONNECTION_PROVIDERS)[number];

export interface StoredOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface CalendarConnectionResponse {
  provider: CalendarConnectionProvider;
  email: string;
  connectedAt: string;
  expiresAt: string | null;
}
