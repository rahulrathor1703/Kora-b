import {
  buildClickTrackingUrl,
  buildOpenTrackingUrl,
  computeEngagementRate,
  extractLinkLabel,
  extractTrackedLinks,
  injectEmailTracking,
  isSafeRedirectUrl,
} from './campaign-tracking.util';
import { signClickLink } from './campaign-tracking-signature.util';

describe('campaign-tracking.util', () => {
  const secret = 'test-tracking-secret';
  const token = 'tok';

  describe('isSafeRedirectUrl', () => {
    it('allows http and https URLs', () => {
      expect(isSafeRedirectUrl('https://example.com/path')).toBe(true);
      expect(isSafeRedirectUrl('http://example.com')).toBe(true);
    });

    it('rejects non-http schemes', () => {
      expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeRedirectUrl('mailto:test@example.com')).toBe(false);
    });
  });

  describe('buildOpenTrackingUrl', () => {
    it('builds open tracking endpoint', () => {
      expect(buildOpenTrackingUrl('http://localhost:3008/', 'abc')).toBe(
        'http://localhost:3008/track/open/abc',
      );
    });
  });

  describe('buildClickTrackingUrl', () => {
    it('builds click tracking endpoint with link index and signature', () => {
      const signature = signClickLink(secret, 'abc', 1);

      expect(
        buildClickTrackingUrl('http://localhost:3008', 'abc', 1, signature),
      ).toBe(
        `http://localhost:3008/track/click/abc?l=1&sig=${encodeURIComponent(signature)}`,
      );
    });
  });

  describe('extractLinkLabel', () => {
    it('uses anchor text when present', () => {
      expect(extractLinkLabel('Book a demo', 'https://example.com')).toBe(
        'Book a demo',
      );
    });

    it('falls back to hostname when anchor text is empty', () => {
      expect(extractLinkLabel('', 'https://example.com/path')).toBe(
        'example.com',
      );
    });
  });

  describe('extractTrackedLinks', () => {
    it('builds a registry with labels and positions', () => {
      const html =
        '<a href="https://one.com">One</a><a href="mailto:a@b.com">Email</a><a href="https://two.com">Two</a>';

      expect(extractTrackedLinks(html)).toEqual([
        { index: 0, url: 'https://one.com', label: 'One' },
        { index: 1, url: 'https://two.com', label: 'Two' },
      ]);
    });
  });

  describe('injectEmailTracking', () => {
    it('wraps links and appends open pixel', () => {
      const html =
        '<html><body><a href="https://example.com">Go</a></body></html>';
      const result = injectEmailTracking(
        html,
        'http://localhost:3008',
        token,
        (linkIndex) => signClickLink(secret, token, linkIndex),
      );

      expect(result.html).toContain('/track/click/tok?l=0&sig=');
      expect(result.html).toContain('/track/open/tok');
      expect(result.html).not.toContain('href="https://example.com"');
      expect(result.trackedLinks).toEqual([
        {
          index: 0,
          url: 'https://example.com',
          label: 'Go',
        },
      ]);
    });

    it('skips mailto links', () => {
      const html = '<a href="mailto:a@b.com">Email</a>';
      const result = injectEmailTracking(
        html,
        'http://localhost:3008',
        token,
        (linkIndex) => signClickLink(secret, token, linkIndex),
      );

      expect(result.html).toContain('href="mailto:a@b.com"');
      expect(result.html).not.toContain('/track/click/');
      expect(result.trackedLinks).toEqual([]);
    });
  });

  describe('computeEngagementRate', () => {
    it('returns 0 when sent is zero', () => {
      expect(computeEngagementRate(5, 0)).toBe(0);
    });

    it('rounds percentage', () => {
      expect(computeEngagementRate(1, 4)).toBe(25);
    });
  });
});
