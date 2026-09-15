export interface StoredGoogleOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
}

export interface GoogleConnectionDto {
  id: string;
  oauthAppId: string;
  email: string;
  connectedAt: string;
  connectedByUserId: string | null;
}

export interface OrganizationGoogleConnectionListItemDto {
  id: string;
  oauthAppId: string;
  email: string;
  connectedAt: string;
  connectedByUserId: string | null;
  propertyCount: number;
}

export interface GoogleOAuthAppListItemDto {
  id: string;
  label: string;
  clientId: string;
  redirectBaseUrl: string;
  redirectUri: string;
  connectionCount: number;
  createdAt: string;
}

export interface Ga4PropertyCandidate {
  propertyId: string;
  propertyName: string;
  accountName: string;
}

export interface GscSiteCandidate {
  siteUrl: string;
  permissionLevel: string;
}

export interface GooglePropertySuggestionsDto {
  ga4: {
    suggested: Ga4PropertyCandidate | null;
    candidates: Ga4PropertyCandidate[];
  };
  gsc: {
    suggested: GscSiteCandidate | null;
    candidates: GscSiteCandidate[];
  };
}

export interface PsiSettingsResponse {
  hasApiKey: boolean;
  hasGoogleConnection: boolean;
}

export interface GoogleOAuthAppSettingsResponse {
  configured: boolean;
  clientId: string | null;
  redirectUri: string;
  redirectBaseUrl: string | null;
  defaultRedirectBaseUrl: string;
}
