export type OnPageAuditRunStatus =
  'pending' | 'running' | 'completed' | 'failed';

export interface SentenceCaseViolation {
  element: string;
  text: string;
}

export interface OnPageExtendedChecks {
  hasCanonical: boolean;
  hasViewport: boolean;
  hasOgTitle: boolean;
  hasOgDescription: boolean;
  hasOgImage: boolean;
  hasJsonLd: boolean;
  isNoindex: boolean;
}

export interface OnPageAuditSummary {
  pagesAudited: number;
  pagesFailed: number;
  avgSeoScore: number;
  missingMetaTitles: number;
  missingMetaDescs: number;
  totalMissingAlt: number;
  sentenceCaseViolations: number;
  thinContentPages: number;
  totalIssues: number;
  issueCategories: Record<string, number>;
}

export interface OnPagePageParseResult {
  url: string;
  httpStatus: number | null;
  scrapeFailed: boolean;
  metaTitle: string;
  metaDesc: string;
  metaTitleLength: number;
  metaDescLength: number;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  wordCount: number;
  isThinContent: boolean;
  imageCount: number;
  missingAltCount: number;
  internalLinkCount: number;
  genericAnchorCount: number;
  sentenceCaseViolations: SentenceCaseViolation[];
  issues: string[];
  issueCount: number;
  seoScore: number;
  checks: OnPageExtendedChecks;
}

export interface WebsitePropertyDto {
  id: string;
  organizationId: string;
  name: string;
  domain: string;
  sitemapUrl: string;
  maxPages: number;
  isActive: boolean;
  ga4Enabled: boolean;
  ga4PropertyId: string | null;
  ga4PropertyName: string | null;
  gscEnabled: boolean;
  gscSiteUrl: string | null;
  psiEnabled: boolean;
  googleEmail: string | null;
  googleConnectionId: string | null;
  googleConnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OnPageAuditRunDto {
  id: string;
  organizationId: string;
  websitePropertyId: string;
  websitePropertyName: string;
  status: OnPageAuditRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  pagesAudited: number;
  pagesFailed: number;
  summary: OnPageAuditSummary;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  scoreTrend: number | null;
}

export interface OnPagePageResultDto {
  id: string;
  auditRunId: string;
  url: string;
  httpStatus: number | null;
  scrapeFailed: boolean;
  metaTitle: string;
  metaDesc: string;
  metaTitleLength: number;
  metaDescLength: number;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  wordCount: number;
  isThinContent: boolean;
  imageCount: number;
  missingAltCount: number;
  internalLinkCount: number;
  genericAnchorCount: number;
  sentenceCaseViolations: SentenceCaseViolation[];
  issues: string[];
  issueCount: number;
  seoScore: number;
  checks: OnPageExtendedChecks;
  createdAt: string;
}

export interface PaginatedOnPagePageResults {
  items: OnPagePageResultDto[];
  total: number;
  page: number;
  pageSize: number;
}
