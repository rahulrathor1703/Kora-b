import type { TrackedLink } from './entities/email-campaign-message.entity';

const TRACKING_PIXEL = `<img src="{{openUrl}}" width="1" height="1" alt="" style="display:none!important;width:1px;height:1px;border:0;" />`;
const MAX_LINK_LABEL_LENGTH = 200;
const ANCHOR_TAG_PATTERN =
  /<a\b([^>]*?\bhref=["'])([^"']+)(["'][^>]*)>([\s\S]*?)<\/a>/gi;

export function buildOpenTrackingUrl(baseUrl: string, token: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}/track/open/${token}`;
}

export function buildClickTrackingUrl(
  baseUrl: string,
  token: string,
  linkIndex: number,
  signature: string,
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    l: String(linkIndex),
    sig: signature,
  });
  return `${normalizedBase}/track/click/${token}?${params.toString()}`;
}

export function buildUnsubscribeTrackingUrl(
  baseUrl: string,
  token: string,
): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  return `${normalizedBase}/track/unsubscribe/${token}`;
}

export function isSafeRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function shouldSkipLinkTracking(href: string): boolean {
  return (
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.includes('/track/click/') ||
    href.includes('/track/unsubscribe/')
  );
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function extractLinkLabel(innerHtml: string, href: string): string {
  const stripped = collapseWhitespace(stripHtmlTags(innerHtml));

  if (stripped.length > 0) {
    return stripped.slice(0, MAX_LINK_LABEL_LENGTH);
  }

  try {
    const hostname = new URL(href).hostname;
    return hostname.slice(0, MAX_LINK_LABEL_LENGTH);
  } catch {
    return href.slice(0, MAX_LINK_LABEL_LENGTH);
  }
}

export function extractTrackedLinks(html: string): TrackedLink[] {
  const trackedLinks: TrackedLink[] = [];
  let linkIndex = 0;

  html.replace(
    ANCHOR_TAG_PATTERN,
    (
      match,
      _prefix: string,
      href: string,
      _suffix: string,
      innerHtml: string,
    ) => {
      if (shouldSkipLinkTracking(href) || !isSafeRedirectUrl(href)) {
        return match;
      }

      trackedLinks.push({
        index: linkIndex,
        url: href,
        label: extractLinkLabel(innerHtml, href),
      });
      linkIndex += 1;
      return match;
    },
  );

  return trackedLinks;
}

export interface InjectEmailTrackingResult {
  html: string;
  trackedLinks: TrackedLink[];
}

export function injectEmailTracking(
  html: string,
  baseUrl: string,
  token: string,
  signLink: (linkIndex: number) => string,
): InjectEmailTrackingResult {
  const trackedLinks: TrackedLink[] = [];
  let linkIndex = 0;

  const withLinks = html.replace(
    ANCHOR_TAG_PATTERN,
    (
      match,
      prefix: string,
      href: string,
      suffix: string,
      innerHtml: string,
    ) => {
      if (shouldSkipLinkTracking(href) || !isSafeRedirectUrl(href)) {
        return match;
      }

      const label = extractLinkLabel(innerHtml, href);
      trackedLinks.push({
        index: linkIndex,
        url: href,
        label,
      });

      const trackedHref = buildClickTrackingUrl(
        baseUrl,
        token,
        linkIndex,
        signLink(linkIndex),
      );
      linkIndex += 1;
      return `<a${prefix}${trackedHref}${suffix}>${innerHtml}</a>`;
    },
  );

  const openUrl = buildOpenTrackingUrl(baseUrl, token);
  const pixel = TRACKING_PIXEL.replace('{{openUrl}}', openUrl);

  const htmlWithPixel = /<\/body>/i.test(withLinks)
    ? withLinks.replace(/<\/body>/i, `${pixel}</body>`)
    : `${withLinks}${pixel}`;

  return {
    html: htmlWithPixel,
    trackedLinks,
  };
}

export function computeEngagementRate(count: number, sent: number): number {
  if (sent <= 0) {
    return 0;
  }

  return Math.round((count / sent) * 100);
}

export const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);
