import { Injectable, Logger } from '@nestjs/common';
import {
  OnPageAuditRunsRepository,
  OnPagePageResultsRepository,
} from './on-page-seo.repository';
import { OnPageHtmlParserService } from './on-page-html-parser.service';
import {
  delay,
  PageFetcherService,
  SitemapFetcherService,
} from './page-fetcher.service';
import { WebsitePropertyEntity } from './entities/website-property.entity';
import type { OnPagePageParseResult } from './types/on-page-seo.types';

const PAGE_DELAY_MS = 2_000;

@Injectable()
export class OnPageAuditRunnerService {
  private readonly logger = new Logger(OnPageAuditRunnerService.name);
  private readonly runningRunIds = new Set<string>();

  constructor(
    private readonly auditRunsRepository: OnPageAuditRunsRepository,
    private readonly pageResultsRepository: OnPagePageResultsRepository,
    private readonly sitemapFetcher: SitemapFetcherService,
    private readonly pageFetcher: PageFetcherService,
    private readonly htmlParser: OnPageHtmlParserService,
  ) {}

  isRunActive(runId: string): boolean {
    return this.runningRunIds.has(runId);
  }

  async executeRun(
    runId: string,
    property: WebsitePropertyEntity,
  ): Promise<void> {
    if (this.runningRunIds.has(runId)) {
      return;
    }

    this.runningRunIds.add(runId);

    try {
      const run = await this.auditRunsRepository.findById(
        runId,
        property.organizationId,
      );

      if (!run) {
        return;
      }

      run.status = 'running';
      run.startedAt = new Date();
      await this.auditRunsRepository.save(run);

      const urls = await this.sitemapFetcher.fetchUrls(
        property.sitemapUrl,
        property.domain,
        property.maxPages,
      );

      const parsedPages: OnPagePageParseResult[] = [];
      let failedCount = 0;

      for (let index = 0; index < urls.length; index += 1) {
        const url = urls[index];

        try {
          const fetchResult = await this.pageFetcher.fetchPage(url);
          const parsed = this.htmlParser.parse(
            fetchResult.html,
            url,
            fetchResult.scrapeFailed ? null : fetchResult.httpStatus,
            fetchResult.scrapeFailed,
          );

          if (parsed.scrapeFailed) {
            failedCount += 1;
          }

          parsedPages.push(parsed);

          const pageResult = this.pageResultsRepository.create({
            auditRunId: runId,
            url: parsed.url,
            httpStatus: parsed.httpStatus,
            scrapeFailed: parsed.scrapeFailed,
            metaTitle: parsed.metaTitle,
            metaDesc: parsed.metaDesc,
            metaTitleLength: parsed.metaTitleLength,
            metaDescLength: parsed.metaDescLength,
            h1s: parsed.h1s,
            h2s: parsed.h2s,
            h3s: parsed.h3s,
            wordCount: parsed.wordCount,
            isThinContent: parsed.isThinContent,
            imageCount: parsed.imageCount,
            missingAltCount: parsed.missingAltCount,
            internalLinkCount: parsed.internalLinkCount,
            genericAnchorCount: parsed.genericAnchorCount,
            sentenceCaseViolations: parsed.sentenceCaseViolations,
            issues: parsed.issues,
            issueCount: parsed.issueCount,
            seoScore: parsed.seoScore,
            checks: parsed.checks,
          });

          await this.pageResultsRepository.save(pageResult);
        } catch (error) {
          failedCount += 1;
          this.logger.error(
            `Failed to audit page ${url} for run ${runId}`,
            error instanceof Error ? error.stack : undefined,
          );
        }

        if (index < urls.length - 1) {
          await delay(PAGE_DELAY_MS);
        }
      }

      const summary = this.htmlParser.aggregateSummary(
        parsedPages,
        failedCount,
      );

      run.status = 'completed';
      run.completedAt = new Date();
      run.pagesAudited = summary.pagesAudited;
      run.pagesFailed = summary.pagesFailed;
      run.summary = summary;
      await this.auditRunsRepository.save(run);
    } catch (error) {
      this.logger.error(
        `Audit run ${runId} failed`,
        error instanceof Error ? error.stack : undefined,
      );

      const run = await this.auditRunsRepository.findById(
        runId,
        property.organizationId,
      );

      if (run) {
        run.status = 'failed';
        run.completedAt = new Date();
        run.errorMessage =
          error instanceof Error ? error.message : 'Unknown audit failure';
        await this.auditRunsRepository.save(run);
      }
    } finally {
      this.runningRunIds.delete(runId);
    }
  }

  startRunAsync(runId: string, property: WebsitePropertyEntity): void {
    void this.executeRun(runId, property);
  }
}
