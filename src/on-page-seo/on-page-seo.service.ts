import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { OrgQuotaService } from '../org-entitlements/org-quota.service';
import {
  CreateWebsitePropertyDto,
  OnPageAuditsQueryDto,
  OnPagePageResultsQueryDto,
  TriggerOnPageAuditDto,
  UpdateWebsitePropertyDto,
} from './dto/on-page-seo.dto';
import { OnPageAuditRunnerService } from './on-page-audit-runner.service';
import { OnPageSeoMapper } from './on-page-seo.mapper';
import {
  OnPageAuditRunsRepository,
  OnPagePageResultsRepository,
  WebsitePropertiesRepository,
} from './on-page-seo.repository';
import type {
  OnPageAuditRunDto,
  OnPagePageResultDto,
  PaginatedOnPagePageResults,
  WebsitePropertyDto,
} from './types/on-page-seo.types';
import { WebsiteGoogleConnectionOAuthService } from '../website/google-connection/website-google-connection-oauth.service';
import { WebsiteSettingsService } from '../website/settings/website-settings.service';

@Injectable()
export class WebsitePropertiesService {
  constructor(
    private readonly repository: WebsitePropertiesRepository,
    private readonly mapper: OnPageSeoMapper,
    private readonly googleOAuthService: WebsiteGoogleConnectionOAuthService,
    private readonly websiteSettingsService: WebsiteSettingsService,
    private readonly orgQuotaService: OrgQuotaService,
  ) {}

  async findAll(organizationId: string | null): Promise<WebsitePropertyDto[]> {
    this.requireOrganizationId(organizationId);
    const items = await this.repository.findByOrganizationId(organizationId);
    const connections =
      await this.googleOAuthService.getConnectionsByPropertyIds(
        items.map((item) => item.id),
      );

    return items.map((item) =>
      this.mapper.toWebsitePropertyDto(item, connections.get(item.id) ?? null),
    );
  }

  async create(
    dto: CreateWebsitePropertyDto,
    organizationId: string | null,
  ): Promise<WebsitePropertyDto> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    await this.orgQuotaService.assertWithinLimit(
      resolvedOrganizationId,
      'website.projects',
    );

    const domain = dto.domain.trim();
    const existing = await this.repository.findByDomain(
      domain,
      resolvedOrganizationId,
    );
    if (existing) {
      throw new ConflictException(
        'A website with this domain already exists for your organization',
      );
    }

    await this.googleOAuthService.assertConnectionBelongsToOrganization(
      dto.googleConnectionId,
      resolvedOrganizationId,
    );

    const entity = this.repository.create({
      organizationId: resolvedOrganizationId,
      name: dto.name.trim(),
      domain,
      sitemapUrl: dto.sitemapUrl.trim(),
      maxPages: dto.maxPages ?? 20,
      isActive: dto.isActive ?? true,
      googleConnectionId: dto.googleConnectionId,
      ga4Enabled: dto.ga4Enabled ?? false,
      ga4PropertyId: dto.ga4PropertyId?.trim() ?? null,
      ga4PropertyName: dto.ga4PropertyName?.trim() ?? null,
      gscEnabled: dto.gscEnabled ?? false,
      gscSiteUrl: dto.gscSiteUrl?.trim() ?? null,
      psiEnabled: dto.psiEnabled ?? false,
    });

    await this.validateIntegrations(
      resolvedOrganizationId,
      dto,
      undefined,
      dto.googleConnectionId,
    );

    const saved = await this.repository.save(entity);

    return this.mapper.toWebsitePropertyDto(
      saved,
      (await this.googleOAuthService.getConnection(
        saved.id,
        resolvedOrganizationId,
      )) ?? null,
    );
  }

  async update(
    id: string,
    dto: UpdateWebsitePropertyDto,
    organizationId: string | null,
  ): Promise<WebsitePropertyDto> {
    this.requireOrganizationId(organizationId);

    const entity = await this.repository.findById(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Website property not found');
    }

    if (dto.name !== undefined) {
      entity.name = dto.name.trim();
    }
    if (dto.domain !== undefined) {
      const domain = dto.domain.trim();
      if (domain !== entity.domain) {
        const existing = await this.repository.findByDomain(
          domain,
          organizationId,
        );
        if (existing && existing.id !== entity.id) {
          throw new ConflictException(
            'A website with this domain already exists for your organization',
          );
        }
      }
      entity.domain = domain;
    }
    if (dto.sitemapUrl !== undefined) {
      entity.sitemapUrl = dto.sitemapUrl.trim();
    }
    if (dto.maxPages !== undefined) {
      entity.maxPages = dto.maxPages;
    }
    if (dto.isActive !== undefined) {
      entity.isActive = dto.isActive;
    }
    if (dto.ga4Enabled !== undefined) {
      entity.ga4Enabled = dto.ga4Enabled;
    }
    if (dto.ga4PropertyId !== undefined) {
      entity.ga4PropertyId = dto.ga4PropertyId.trim() || null;
    }
    if (dto.ga4PropertyName !== undefined) {
      entity.ga4PropertyName = dto.ga4PropertyName.trim() || null;
    }
    if (dto.gscEnabled !== undefined) {
      entity.gscEnabled = dto.gscEnabled;
    }
    if (dto.gscSiteUrl !== undefined) {
      entity.gscSiteUrl = dto.gscSiteUrl.trim() || null;
    }
    if (dto.psiEnabled !== undefined) {
      entity.psiEnabled = dto.psiEnabled;
    }

    await this.validateIntegrations(
      organizationId,
      {
        ga4Enabled: entity.ga4Enabled,
        ga4PropertyId: entity.ga4PropertyId ?? undefined,
        gscEnabled: entity.gscEnabled,
        gscSiteUrl: entity.gscSiteUrl ?? undefined,
        psiEnabled: entity.psiEnabled,
      },
      id,
      entity.googleConnectionId,
    );

    const saved = await this.repository.save(entity);
    const connection = await this.googleOAuthService.getConnection(
      id,
      organizationId,
    );

    return this.mapper.toWebsitePropertyDto(saved, connection);
  }

  async delete(id: string, organizationId: string | null): Promise<void> {
    this.requireOrganizationId(organizationId);

    const deleted = await this.repository.deleteById(id, organizationId);
    if (!deleted) {
      throw new NotFoundException('Website property not found');
    }
  }

  private requireOrganizationId(
    organizationId: string | null,
  ): asserts organizationId is string {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
  }

  private async validateIntegrations(
    organizationId: string,
    dto: {
      ga4Enabled?: boolean;
      ga4PropertyId?: string;
      gscEnabled?: boolean;
      gscSiteUrl?: string;
      psiEnabled?: boolean;
    },
    websitePropertyId?: string,
    googleConnectionId?: string | null,
  ): Promise<void> {
    const ga4Enabled = dto.ga4Enabled ?? false;
    const gscEnabled = dto.gscEnabled ?? false;
    const psiEnabled = dto.psiEnabled ?? false;

    if (ga4Enabled || gscEnabled) {
      const hasGoogle = websitePropertyId
        ? await this.googleOAuthService.hasConnection(websitePropertyId)
        : Boolean(googleConnectionId);

      if (!hasGoogle) {
        throw new BadRequestException(
          'Connect a Google account for this website before enabling GA4 or Search Console.',
        );
      }
    }

    if (ga4Enabled && !dto.ga4PropertyId?.trim()) {
      throw new BadRequestException(
        'Select a GA4 property when GA4 integration is enabled.',
      );
    }

    if (gscEnabled && !dto.gscSiteUrl?.trim()) {
      throw new BadRequestException(
        'Select a Search Console site when GSC integration is enabled.',
      );
    }

    if (psiEnabled) {
      const hasPsiAuth = websitePropertyId
        ? await this.websiteSettingsService.hasPsiAuthForProperty(
            organizationId,
            websitePropertyId,
          )
        : await this.websiteSettingsService.hasPsiAuth(organizationId);

      if (!hasPsiAuth) {
        throw new BadRequestException(
          'Connect Google for this website or configure a PageSpeed Insights API key before enabling PSI.',
        );
      }
    }
  }
}

@Injectable()
export class OnPageAuditsService {
  constructor(
    private readonly websitePropertiesRepository: WebsitePropertiesRepository,
    private readonly auditRunsRepository: OnPageAuditRunsRepository,
    private readonly pageResultsRepository: OnPagePageResultsRepository,
    private readonly auditRunner: OnPageAuditRunnerService,
    private readonly mapper: OnPageSeoMapper,
  ) {}

  async listAudits(
    query: OnPageAuditsQueryDto,
    organizationId: string | null,
  ): Promise<{
    items: OnPageAuditRunDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.requireOrganizationId(organizationId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const result = await this.auditRunsRepository.findPaginated(
      organizationId,
      {
        websitePropertyId: query.websitePropertyId,
        page,
        pageSize,
      },
    );

    const items = await Promise.all(
      result.items.map(async (run) => {
        const scoreTrend = await this.computeScoreTrend(run);
        return this.mapper.toAuditRunDto(run, scoreTrend);
      }),
    );

    return {
      items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async getAudit(
    id: string,
    organizationId: string | null,
  ): Promise<OnPageAuditRunDto> {
    this.requireOrganizationId(organizationId);

    const run = await this.auditRunsRepository.findById(id, organizationId);
    if (!run) {
      throw new NotFoundException('Audit run not found');
    }

    const scoreTrend = await this.computeScoreTrend(run);
    return this.mapper.toAuditRunDto(run, scoreTrend);
  }

  async listPageResults(
    auditRunId: string,
    query: OnPagePageResultsQueryDto,
    organizationId: string | null,
  ): Promise<PaginatedOnPagePageResults> {
    this.requireOrganizationId(organizationId);

    const run = await this.auditRunsRepository.findById(
      auditRunId,
      organizationId,
    );
    if (!run) {
      throw new NotFoundException('Audit run not found');
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const result = await this.pageResultsRepository.findPaginatedByAuditRunId(
      auditRunId,
      {
        page,
        pageSize,
        hasIssuesOnly: query.hasIssuesOnly,
        thinContentOnly: query.thinContentOnly,
        minScore: query.minScore,
        maxScore: query.maxScore,
      },
    );

    return {
      items: result.items.map((item) => this.mapper.toPageResultDto(item)),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
  }

  async triggerAudit(
    dto: TriggerOnPageAuditDto,
    organizationId: string | null,
  ): Promise<OnPageAuditRunDto[]> {
    this.requireOrganizationId(organizationId);

    const properties = dto.propertyId
      ? await this.websitePropertiesRepository
          .findById(dto.propertyId, organizationId)
          .then((property) => (property && property.isActive ? [property] : []))
      : await this.websitePropertiesRepository.findActiveByOrganizationId(
          organizationId,
        );

    if (properties.length === 0) {
      throw new BadRequestException(
        dto.propertyId
          ? 'Website property not found or inactive'
          : 'No active website properties configured',
      );
    }

    const createdRuns: OnPageAuditRunDto[] = [];

    for (const property of properties) {
      const run = this.auditRunsRepository.create({
        organizationId,
        websitePropertyId: property.id,
        status: 'pending',
      });
      const savedRun = await this.auditRunsRepository.save(run);
      this.auditRunner.startRunAsync(savedRun.id, property);
      createdRuns.push(this.mapper.toAuditRunDto(savedRun, null));
    }

    return createdRuns;
  }

  async getAllPageResultsForExport(
    auditRunId: string,
    organizationId: string | null,
  ): Promise<OnPagePageResultDto[]> {
    this.requireOrganizationId(organizationId);

    const run = await this.auditRunsRepository.findById(
      auditRunId,
      organizationId,
    );
    if (!run) {
      throw new NotFoundException('Audit run not found');
    }

    const allResults: OnPagePageResultDto[] = [];
    let page = 1;
    const pageSize = 200;

    while (true) {
      const batch = await this.pageResultsRepository.findPaginatedByAuditRunId(
        auditRunId,
        { page, pageSize },
      );

      allResults.push(
        ...batch.items.map((item) => this.mapper.toPageResultDto(item)),
      );

      if (allResults.length >= batch.total) {
        break;
      }

      page += 1;
    }

    return allResults;
  }

  private async computeScoreTrend(
    run: import('./entities/on-page-audit-run.entity').OnPageAuditRunEntity,
  ): Promise<number | null> {
    if (run.status !== 'completed') {
      return null;
    }

    const previous =
      await this.auditRunsRepository.findLatestCompletedByPropertyId(
        run.websitePropertyId,
        run.organizationId,
        run.id,
      );

    if (!previous?.summary?.avgSeoScore) {
      return null;
    }

    return run.summary.avgSeoScore - previous.summary.avgSeoScore;
  }

  private requireOrganizationId(
    organizationId: string | null,
  ): asserts organizationId is string {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }
  }
}
