import { Injectable } from '@nestjs/common';
import type {
  OnPageExtendedChecks,
  OnPageAuditSummary,
  OnPagePageParseResult,
  SentenceCaseViolation,
} from './types/on-page-seo.types';

const GENERIC_ANCHORS = new Set([
  'click here',
  'here',
  'read more',
  'learn more',
  'more',
]);

const IMG_TAG_PATTERN = new RegExp('<' + 'img[^>]+>', 'gi');

function isSentenceCase(text: string): boolean {
  if (!text || text.length < 4) {
    return true;
  }

  const words = text.split(' ').filter((word) => word.length > 3);
  if (words.length === 0) {
    return true;
  }

  const allCaps = words.every((word) => word === word.toUpperCase());
  const titleCase =
    words.filter((word) => /^[A-Z]/.test(word)).length > words.length * 0.6;

  return !allCaps && !titleCase;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function extractMetaContent(html: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["']`,
    'i',
  );
  const reversePattern = new RegExp(
    `<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`,
    'i',
  );

  return (
    (html.match(pattern) || html.match(reversePattern) || [])[1]?.trim() ?? ''
  );
}

function extractCanonical(html: string): string {
  const match =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);

  return match?.[1]?.trim() ?? '';
}

function computeSeoScore(issues: string[]): number {
  let score = 100;

  for (const issue of issues) {
    const lower = issue.toLowerCase();

    if (
      lower.includes('missing meta title') ||
      lower.includes('missing h1') ||
      lower.includes('noindex') ||
      lower.startsWith('http')
    ) {
      score -= 15;
      continue;
    }

    if (
      lower.includes('meta title') ||
      lower.includes('meta desc') ||
      lower.includes('alt text') ||
      lower.includes('thin content') ||
      lower.includes('multiple h1') ||
      lower.includes('missing meta description') ||
      lower.includes('missing canonical') ||
      lower.includes('missing viewport') ||
      lower.includes('missing og:') ||
      lower.includes('missing json-ld') ||
      lower.includes('internal links')
    ) {
      score -= 5;
      continue;
    }

    score -= 2;
  }

  return Math.max(0, score);
}

function categorizeIssue(issue: string): string {
  const lower = issue.toLowerCase();

  if (lower.includes('meta')) {
    return 'meta';
  }

  if (lower.includes('h1') || lower.includes('heading')) {
    return 'headings';
  }

  if (lower.includes('content') || lower.includes('word')) {
    return 'content';
  }

  if (lower.includes('link') || lower.includes('anchor')) {
    return 'links';
  }

  if (lower.includes('alt') || lower.includes('image')) {
    return 'images';
  }

  if (
    lower.includes('og:') ||
    lower.includes('canonical') ||
    lower.includes('viewport') ||
    lower.includes('json-ld') ||
    lower.includes('noindex')
  ) {
    return 'social';
  }

  if (lower.includes('sentence case')) {
    return 'copy';
  }

  return 'other';
}

@Injectable()
export class OnPageHtmlParserService {
  parse(
    html: string,
    url: string,
    httpStatus: number | null,
    scrapeFailed: boolean,
  ): OnPagePageParseResult {
    if (scrapeFailed || !html) {
      return {
        url,
        httpStatus,
        scrapeFailed: true,
        metaTitle: '',
        metaDesc: '',
        metaTitleLength: 0,
        metaDescLength: 0,
        h1s: [],
        h2s: [],
        h3s: [],
        wordCount: 0,
        isThinContent: false,
        imageCount: 0,
        missingAltCount: 0,
        internalLinkCount: 0,
        genericAnchorCount: 0,
        sentenceCaseViolations: [],
        issues: scrapeFailed ? ['Page scrape failed'] : ['Empty page content'],
        issueCount: 1,
        seoScore: 0,
        checks: {
          hasCanonical: false,
          hasViewport: false,
          hasOgTitle: false,
          hasOgDescription: false,
          hasOgImage: false,
          hasJsonLd: false,
          isNoindex: false,
        },
      };
    }

    const metaTitle =
      (html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1]?.trim() ?? '';
    const metaDesc = extractMetaContent(html, 'description');

    const h1s = [...html.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) =>
      stripTags(match[1]),
    );
    const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) =>
      stripTags(match[1]),
    );
    const h3s = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].map((match) =>
      stripTags(match[1]),
    );

    const sentenceCaseViolations: SentenceCaseViolation[] = [];
    if (metaTitle && !isSentenceCase(metaTitle)) {
      sentenceCaseViolations.push({ element: 'meta_title', text: metaTitle });
    }
    if (metaDesc && !isSentenceCase(metaDesc)) {
      sentenceCaseViolations.push({ element: 'meta_desc', text: metaDesc });
    }
    for (const heading of h1s) {
      if (!isSentenceCase(heading)) {
        sentenceCaseViolations.push({ element: 'H1', text: heading });
      }
    }
    for (const heading of h2s) {
      if (!isSentenceCase(heading)) {
        sentenceCaseViolations.push({ element: 'H2', text: heading });
      }
    }
    for (const heading of h3s) {
      if (!isSentenceCase(heading)) {
        sentenceCaseViolations.push({ element: 'H3', text: heading });
      }
    }

    const allImgs = [...html.matchAll(IMG_TAG_PATTERN)].map(
      (match) => match[0],
    );
    const missingAlt = allImgs.filter(
      (tag) => !tag.match(/alt=["'][^"']+["']/i),
    ).length;

    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const wordCount = textContent
      .split(' ')
      .filter((word) => word.length > 1).length;
    const isThinContent = wordCount < 300;

    const brandDomain = url.replace(/https?:\/\//, '').split('/')[0] ?? '';
    const allLinks = [...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)].map(
      (match) => match[1],
    );
    const internalLinks = allLinks.filter(
      (link) => link.startsWith('/') || link.includes(brandDomain),
    );
    const anchorTexts = [...html.matchAll(/<a[^>]+>([\s\S]*?)<\/a>/gi)]
      .map((match) => stripTags(match[1]))
      .filter((text) => text.length > 0);
    const genericAnchors = anchorTexts.filter((text) =>
      GENERIC_ANCHORS.has(text.toLowerCase()),
    );

    const canonical = extractCanonical(html);
    const robotsContent = extractMetaContent(html, 'robots').toLowerCase();
    const checks: OnPageExtendedChecks = {
      hasCanonical: canonical.length > 0,
      hasViewport: extractMetaContent(html, 'viewport').length > 0,
      hasOgTitle: extractMetaContent(html, 'og:title').length > 0,
      hasOgDescription: extractMetaContent(html, 'og:description').length > 0,
      hasOgImage: extractMetaContent(html, 'og:image').length > 0,
      hasJsonLd: /<script[^>]*type=["']application\/ld\+json["']/i.test(html),
      isNoindex: robotsContent.includes('noindex'),
    };

    const issues: string[] = [];

    if (httpStatus !== null && httpStatus >= 400) {
      issues.push(`HTTP ${httpStatus} response`);
    }

    if (!metaTitle) {
      issues.push('Missing meta title');
    } else if (metaTitle.length > 60) {
      issues.push(`Meta title too long: ${metaTitle.length} chars`);
    } else if (metaTitle.length < 30) {
      issues.push(`Meta title too short: ${metaTitle.length} chars`);
    }

    if (!metaDesc) {
      issues.push('Missing meta description');
    } else if (metaDesc.length > 160) {
      issues.push(`Meta desc too long: ${metaDesc.length} chars`);
    } else if (metaDesc.length < 70) {
      issues.push(`Meta desc too short: ${metaDesc.length} chars`);
    }

    if (h1s.length === 0) {
      issues.push('Missing H1');
    } else if (h1s.length > 1) {
      issues.push(`Multiple H1s: ${h1s.length}`);
    }

    if (missingAlt > 0) {
      issues.push(`${missingAlt} images missing alt text`);
    }

    if (isThinContent) {
      issues.push(`Thin content: ${wordCount} words`);
    }

    if (sentenceCaseViolations.length > 0) {
      issues.push(`${sentenceCaseViolations.length} sentence case violations`);
    }

    if (genericAnchors.length > 0) {
      issues.push(`${genericAnchors.length} generic anchor texts`);
    }

    if (internalLinks.length < 2) {
      issues.push('Very few internal links');
    }

    if (!checks.hasCanonical) {
      issues.push('Missing canonical tag');
    }

    if (!checks.hasViewport) {
      issues.push('Missing viewport meta tag');
    }

    if (!checks.hasOgTitle) {
      issues.push('Missing og:title');
    }

    if (!checks.hasOgDescription) {
      issues.push('Missing og:description');
    }

    if (!checks.hasOgImage) {
      issues.push('Missing og:image');
    }

    if (!checks.hasJsonLd) {
      issues.push('Missing JSON-LD structured data');
    }

    if (checks.isNoindex) {
      issues.push('Page has noindex directive');
    }

    const seoScore = computeSeoScore(issues);

    return {
      url,
      httpStatus,
      scrapeFailed: false,
      metaTitle,
      metaDesc,
      metaTitleLength: metaTitle.length,
      metaDescLength: metaDesc.length,
      h1s,
      h2s,
      h3s,
      wordCount,
      isThinContent,
      imageCount: allImgs.length,
      missingAltCount: missingAlt,
      internalLinkCount: internalLinks.length,
      genericAnchorCount: genericAnchors.length,
      sentenceCaseViolations,
      issues,
      issueCount: issues.length,
      seoScore,
      checks,
    };
  }

  aggregateSummary(
    pages: OnPagePageParseResult[],
    failedCount: number,
  ): OnPageAuditSummary {
    const successfulPages = pages.filter((page) => !page.scrapeFailed);
    const issueCategories: Record<string, number> = {};

    for (const page of successfulPages) {
      for (const issue of page.issues) {
        const category = categorizeIssue(issue);
        issueCategories[category] = (issueCategories[category] ?? 0) + 1;
      }
    }

    const avgSeoScore =
      successfulPages.length > 0
        ? Math.round(
            successfulPages.reduce((sum, page) => sum + page.seoScore, 0) /
              successfulPages.length,
          )
        : 0;

    return {
      pagesAudited: successfulPages.length,
      pagesFailed: failedCount,
      avgSeoScore,
      missingMetaTitles: successfulPages.filter((page) => !page.metaTitle)
        .length,
      missingMetaDescs: successfulPages.filter((page) => !page.metaDesc).length,
      totalMissingAlt: successfulPages.reduce(
        (sum, page) => sum + page.missingAltCount,
        0,
      ),
      sentenceCaseViolations: successfulPages.reduce(
        (sum, page) => sum + page.sentenceCaseViolations.length,
        0,
      ),
      thinContentPages: successfulPages.filter((page) => page.isThinContent)
        .length,
      totalIssues: successfulPages.reduce(
        (sum, page) => sum + page.issueCount,
        0,
      ),
      issueCategories,
    };
  }
}
