export const MARKOS_TRACKING_TOKEN_HEADER = 'X-Markos-Tracking-Token';
export const MARKOS_TRACK_HTML_MARKER_PREFIX = 'markos-track:';

const TRACKING_TOKEN_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function buildCorrelationHtmlMarker(trackingToken: string): string {
  return `<!-- ${MARKOS_TRACK_HTML_MARKER_PREFIX}${trackingToken} -->`;
}

export function injectCorrelationMarker(
  html: string,
  trackingToken: string,
): string {
  const marker = buildCorrelationHtmlMarker(trackingToken);

  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${marker}</body>`);
  }

  return `${html}${marker}`;
}

export function extractTrackingTokenFromText(text: string): string | null {
  const markerMatch = text.match(
    new RegExp(
      `${MARKOS_TRACK_HTML_MARKER_PREFIX}(${TRACKING_TOKEN_PATTERN.source})`,
      'i',
    ),
  );

  if (markerMatch?.[1]) {
    return markerMatch[1].toLowerCase();
  }

  const headerMatch = text.match(
    new RegExp(
      `${MARKOS_TRACKING_TOKEN_HEADER}:\\s*(${TRACKING_TOKEN_PATTERN.source})`,
      'i',
    ),
  );

  if (headerMatch?.[1]) {
    return headerMatch[1].toLowerCase();
  }

  return null;
}

export type CampaignCorrelationMethod =
  | 'pixel'
  | 'click_redirect'
  | 'imap_token'
  | 'imap_message_id'
  | 'imap_fallback';
