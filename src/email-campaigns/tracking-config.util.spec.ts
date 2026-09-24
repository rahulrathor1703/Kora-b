import {
  buildRecommendedTrackingBaseUrl,
  buildTrackingBaseUrlCandidates,
  formatTrackingBaseUrlForDisplay,
  isLocalTrackingHostname,
  isTrackingBaseUrlPubliclyReachable,
  resolveTrackingBaseUrl,
  resolveEffectiveTrackingBaseUrl,
  buildTrackingOpenProbeUrl,
  TRACKING_OPEN_PROBE_TOKEN,
} from './tracking-config.util';

describe('tracking-config.util', () => {
  describe('isLocalTrackingHostname', () => {
    it('returns true for localhost and loopback', () => {
      expect(isLocalTrackingHostname('localhost')).toBe(true);
      expect(isLocalTrackingHostname('127.0.0.1')).toBe(true);
    });

    it('returns false for public hostnames', () => {
      expect(isLocalTrackingHostname('api.example.com')).toBe(false);
    });
  });

  describe('isTrackingBaseUrlPubliclyReachable', () => {
    it('returns false for localhost URLs', () => {
      expect(isTrackingBaseUrlPubliclyReachable('http://localhost:3008')).toBe(
        false,
      );
    });

    it('returns true for public URLs', () => {
      expect(
        isTrackingBaseUrlPubliclyReachable('https://api.example.com'),
      ).toBe(true);
    });

    it('returns false for invalid URLs', () => {
      expect(isTrackingBaseUrlPubliclyReachable('not-a-url')).toBe(false);
    });
  });

  describe('formatTrackingBaseUrlForDisplay', () => {
    it('returns full URL for localhost', () => {
      expect(formatTrackingBaseUrlForDisplay('http://localhost:3008/')).toBe(
        'http://localhost:3008',
      );
    });

    it('returns origin for public URLs', () => {
      expect(
        formatTrackingBaseUrlForDisplay('https://api.example.com/track'),
      ).toBe('https://api.example.com');
    });

    it('preserves /api suffix for frontend proxy URLs', () => {
      expect(
        formatTrackingBaseUrlForDisplay(
          'https://devmarketniti.evervent.live/api',
        ),
      ).toBe('https://devmarketniti.evervent.live/api');
    });
  });

  describe('resolveEffectiveTrackingBaseUrl', () => {
    it('defaults to frontend /api when tracking URL is unset', () => {
      expect(
        resolveEffectiveTrackingBaseUrl({
          frontendUrl: 'https://app.example.com',
        }),
      ).toBe('https://app.example.com/api');
    });

    it('prefers explicit tracking URL', () => {
      expect(
        resolveEffectiveTrackingBaseUrl({
          trackingBaseUrl: 'https://custom.example.com/api',
          frontendUrl: 'https://app.example.com',
        }),
      ).toBe('https://custom.example.com/api');
    });
  });

  describe('resolveTrackingBaseUrl', () => {
    it('falls back when env values are empty strings', () => {
      expect(resolveTrackingBaseUrl('', '')).toBe('http://localhost:3008');
    });

    it('prefers TRACKING_BASE_URL over BACKEND_URL', () => {
      expect(
        resolveTrackingBaseUrl(
          'https://api.example.com',
          'https://other.example.com',
        ),
      ).toBe('https://api.example.com');
    });

    it('uses BACKEND_URL when TRACKING_BASE_URL is unset', () => {
      expect(resolveTrackingBaseUrl(undefined, 'https://api.example.com')).toBe(
        'https://api.example.com',
      );
    });
  });

  describe('buildTrackingOpenProbeUrl', () => {
    it('builds the open tracking probe URL', () => {
      expect(buildTrackingOpenProbeUrl('https://api.example.com/')).toBe(
        `https://api.example.com/track/open/${TRACKING_OPEN_PROBE_TOKEN}`,
      );
    });

    it('returns null for invalid URLs', () => {
      expect(buildTrackingOpenProbeUrl('not-a-url')).toBeNull();
    });
  });

  describe('buildTrackingBaseUrlCandidates', () => {
    it('adds /api candidate for frontend-style public URLs', () => {
      expect(
        buildTrackingBaseUrlCandidates('https://devmarketniti.evervent.live'),
      ).toEqual([
        'https://devmarketniti.evervent.live',
        'https://devmarketniti.evervent.live/api',
      ]);
    });

    it('does not duplicate /api when already present', () => {
      expect(
        buildTrackingBaseUrlCandidates(
          'https://devmarketniti.evervent.live/api',
        ),
      ).toEqual(['https://devmarketniti.evervent.live/api']);
    });
  });

  describe('buildRecommendedTrackingBaseUrl', () => {
    it('prefers /api on the configured tracking host', () => {
      expect(
        buildRecommendedTrackingBaseUrl(
          'https://devmarketniti.evervent.live',
          'https://marketniti.evervent.live',
        ),
      ).toBe('https://devmarketniti.evervent.live/api');
    });
  });
});
