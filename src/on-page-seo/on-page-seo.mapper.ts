import { Injectable } from '@nestjs/common';
import { OnPageAuditRunEntity } from './entities/on-page-audit-run.entity';
import { OnPagePageResultEntity } from './entities/on-page-page-result.entity';
import { WebsitePropertyEntity } from './entities/website-property.entity';
import type {
  OnPageAuditRunDto,
  OnPageAuditSummary,
  OnPagePageResultDto,
  WebsitePropertyDto,
} from './types/on-page-seo.types';
import type { GoogleConnectionDto } from '../website/types/website.types';

const EMPTY_SUMMARY: OnPageAuditSummary = {
  pagesAudited: 0,
  pagesFailed: 0,
  avgSeoScore: 0,
  missingMetaTitles: 0,
  missingMetaDescs: 0,
  totalMissingAlt: 0,
  sentenceCaseViolations: 0,
  thinContentPages: 0,
  totalIssues: 0,
  issueCategories: {},
};

@Injectable()
export class OnPageSeoMapper {
  toWebsitePropertyDto(
    entity: WebsitePropertyEntity,
    googleConnection?: GoogleConnectionDto | null,
  ): WebsitePropertyDto {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      name: entity.name,
      domain: entity.domain,
      sitemapUrl: entity.sitemapUrl,
      maxPages: entity.maxPages,
      isActive: entity.isActive,
      ga4Enabled: entity.ga4Enabled,
      ga4PropertyId: entity.ga4PropertyId,
      ga4PropertyName: entity.ga4PropertyName,
      gscEnabled: entity.gscEnabled,
      gscSiteUrl: entity.gscSiteUrl,
      psiEnabled: entity.psiEnabled,
      googleEmail: googleConnection?.email ?? null,
      googleConnectionId: entity.googleConnectionId,
      googleConnectedAt: googleConnection?.connectedAt ?? null,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  toAuditRunDto(
    entity: OnPageAuditRunEntity,
    scoreTrend: number | null = null,
  ): OnPageAuditRunDto {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      websitePropertyId: entity.websitePropertyId,
      websitePropertyName: entity.websiteProperty?.name ?? '',
      status: entity.status,
      startedAt: entity.startedAt?.toISOString() ?? null,
      completedAt: entity.completedAt?.toISOString() ?? null,
      pagesAudited: entity.pagesAudited,
      pagesFailed: entity.pagesFailed,
      summary: entity.summary ?? EMPTY_SUMMARY,
      errorMessage: entity.errorMessage,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      scoreTrend,
    };
  }

  toPageResultDto(entity: OnPagePageResultEntity): OnPagePageResultDto {
    return {
      id: entity.id,
      auditRunId: entity.auditRunId,
      url: entity.url,
      httpStatus: entity.httpStatus,
      scrapeFailed: entity.scrapeFailed,
      metaTitle: entity.metaTitle,
      metaDesc: entity.metaDesc,
      metaTitleLength: entity.metaTitleLength,
      metaDescLength: entity.metaDescLength,
      h1s: entity.h1s,
      h2s: entity.h2s,
      h3s: entity.h3s,
      wordCount: entity.wordCount,
      isThinContent: entity.isThinContent,
      imageCount: entity.imageCount,
      missingAltCount: entity.missingAltCount,
      internalLinkCount: entity.internalLinkCount,
      genericAnchorCount: entity.genericAnchorCount,
      sentenceCaseViolations: entity.sentenceCaseViolations,
      issues: entity.issues,
      issueCount: entity.issueCount,
      seoScore: entity.seoScore,
      checks: entity.checks,
      createdAt: entity.createdAt.toISOString(),
    };
  }
}
