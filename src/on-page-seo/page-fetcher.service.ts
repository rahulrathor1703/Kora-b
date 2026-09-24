import { Injectable, Logger } from '@nestjs/common';

const FETCH_TIMEOUT_MS = 15_000;

export interface PageFetchResult {
  html: string;
  httpStatus: number;
  scrapeFailed: boolean;
}

@Injectable()
export class PageFetcherService {
  private readonly logger = new Logger(PageFetcherService.name);

  async fetchPage(url: string): Promise<PageFetchResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Markos-OnPage-Audit/1.0',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      });

      const html = await response.text();

      return {
        html,
        httpStatus: response.status,
        scrapeFailed: false,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to fetch page ${url}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );

      return {
        html: '',
        httpStatus: 0,
        scrapeFailed: true,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

@Injectable()
export class SitemapFetcherService {
  private readonly logger = new Logger(SitemapFetcherService.name);

  async fetchUrls(
    sitemapUrl: string,
    domain: string,
    maxPages: number,
  ): Promise<string[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(sitemapUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Markos-OnPage-Audit/1.0',
          Accept: 'application/xml,text/xml,*/*',
        },
      });

      if (!response.ok) {
        this.logger.warn(
          `Sitemap fetch failed for ${sitemapUrl}: HTTP ${response.status}`,
        );
        return [`https://${domain.replace(/^https?:\/\//, '')}`];
      }

      const xml = await response.text();
      const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((match) => match[1].trim().replace(/([^:])\/\//g, '$1/'))
        .slice(0, maxPages);

      if (urls.length === 0) {
        return [`https://${domain.replace(/^https?:\/\//, '')}`];
      }

      return urls;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch sitemap ${sitemapUrl}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return [`https://${domain.replace(/^https?:\/\//, '')}`];
    } finally {
      clearTimeout(timeout);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export { delay };
