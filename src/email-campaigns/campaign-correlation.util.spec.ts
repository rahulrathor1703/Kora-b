import {
  buildCorrelationHtmlMarker,
  extractTrackingTokenFromText,
  injectCorrelationMarker,
  MARKOS_TRACKING_TOKEN_HEADER,
} from './campaign-correlation.util';

describe('campaign-correlation.util', () => {
  const token = '11111111-2222-3333-4444-555555555555';

  it('builds HTML marker and injects before closing body', () => {
    expect(buildCorrelationHtmlMarker(token)).toBe(
      `<!-- markos-track:${token} -->`,
    );

    const html = injectCorrelationMarker(
      '<html><body><p>Hi</p></body></html>',
      token,
    );
    expect(html).toContain(buildCorrelationHtmlMarker(token));
  });

  it('extracts token from HTML marker and header', () => {
    const text = [
      `${MARKOS_TRACKING_TOKEN_HEADER}: ${token}`,
      buildCorrelationHtmlMarker(token),
    ].join('\n');

    expect(extractTrackingTokenFromText(text)).toBe(token);
  });
});
