export const TRACKING_OPEN_PROBE_TOKEN = '00000000-0000-0000-0000-000000000099';

export interface ResolveEffectiveTrackingBaseUrlOptions {
  trackingBaseUrl?: string;
  frontendUrl?: string;
  backendUrl?: string;
}

export function resolveEffectiveTrackingBaseUrl(
  options: ResolveEffectiveTrackingBaseUrlOptions,
): string {
  const explicit = options.trackingBaseUrl?.trim();

  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const frontend = options.frontendUrl?.trim().replace(/\/$/, '');

  if (frontend) {
    return `${frontend}/api`;
  }

  const backend = options.backendUrl?.trim().replace(/\/$/, '');

  if (backend) {
    return backend;
  }

  return 'http://localhost:3008';
}

export function resolveTrackingBaseUrl(
  trackingBaseUrl?: string,
  backendUrl?: string,
  frontendUrl?: string,
): string {
  return resolveEffectiveTrackingBaseUrl({
    trackingBaseUrl,
    backendUrl,
    frontendUrl,
  });
}

export function isLocalTrackingHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function parseTrackingBaseUrl(trackingBaseUrl: string): URL | null {
  try {
    return new URL(trackingBaseUrl);
  } catch {
    return null;
  }
}

export function isTrackingBaseUrlPubliclyReachable(
  trackingBaseUrl: string,
): boolean {
  const parsed = parseTrackingBaseUrl(trackingBaseUrl);
  if (!parsed) {
    return false;
  }

  return !isLocalTrackingHostname(parsed.hostname);
}

export function buildTrackingOpenProbeUrl(
  trackingBaseUrl: string,
): string | null {
  if (!parseTrackingBaseUrl(trackingBaseUrl)) {
    return null;
  }

  const normalizedBase = trackingBaseUrl.replace(/\/$/, '');
  return `${normalizedBase}/track/open/${TRACKING_OPEN_PROBE_TOKEN}`;
}

export async function verifyTrackingOpenEndpoint(
  trackingBaseUrl: string,
): Promise<boolean> {
  const result = await probeTrackingOpenEndpoint(trackingBaseUrl);
  return result.verified;
}

export interface TrackingOpenProbeResult {
  verified: boolean;
  error?: string;
  suggestedTrackingBaseUrl?: string;
}

export function buildTrackingBaseUrlCandidates(
  trackingBaseUrl: string,
): string[] {
  const normalized = trackingBaseUrl.trim().replace(/\/$/, '');
  const parsed = parseTrackingBaseUrl(normalized);

  if (!parsed) {
    return [normalized];
  }

  const candidates = [normalized];
  const origin = parsed.origin.replace(/\/$/, '');
  const withApi = `${origin}/api`;

  if (!normalized.endsWith('/api')) {
    candidates.push(withApi);
  }

  return [...new Set(candidates)];
}

async function probeTrackingOpenUrl(
  probeUrl: string,
): Promise<TrackingOpenProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(probeUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
    });
    const contentType = response.headers.get('content-type') ?? '';
    const verified =
      (response.ok || response.status === 302) &&
      contentType.includes('image/gif');

    if (verified) {
      return { verified: true };
    }

    if (response.status >= 300 && response.status < 400) {
      return {
        verified: false,
        error: `Open endpoint redirected to login (HTTP ${response.status}) — use the frontend /api proxy, e.g. https://your-app.example.com/api`,
      };
    }

    return {
      verified: false,
      error: `Open endpoint returned HTTP ${response.status} with content-type ${contentType || 'unknown'}`,
    };
  } catch (error) {
    return {
      verified: false,
      error:
        error instanceof Error ? error.message : 'Open endpoint probe failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function probeTrackingOpenEndpoint(
  trackingBaseUrl: string,
  options?: { localFallbackPort?: number },
): Promise<TrackingOpenProbeResult> {
  const candidates = buildTrackingBaseUrlCandidates(trackingBaseUrl);
  let lastError: string | undefined;

  for (const candidate of candidates) {
    const probeUrl = buildTrackingOpenProbeUrl(candidate);
    if (!probeUrl) {
      lastError = 'TRACKING_BASE_URL is not a valid URL';
      continue;
    }

    const result = await probeTrackingOpenUrl(probeUrl);
    if (result.verified) {
      const configured = trackingBaseUrl.trim().replace(/\/$/, '');
      return {
        verified: true,
        suggestedTrackingBaseUrl:
          candidate !== configured ? candidate : undefined,
      };
    }

    lastError = result.error;
  }

  const localPort = options?.localFallbackPort;
  if (localPort) {
    const localProbeUrl = `http://127.0.0.1:${localPort}/track/open/${TRACKING_OPEN_PROBE_TOKEN}`;
    const localResult = await probeTrackingOpenUrl(localProbeUrl);
    if (localResult.verified) {
      return { verified: true };
    }

    lastError = localResult.error ?? lastError;
  }

  return {
    verified: false,
    error: lastError ?? 'Open endpoint probe failed',
    suggestedTrackingBaseUrl:
      candidates.length > 1 ? candidates[candidates.length - 1] : undefined,
  };
}

export function buildRecommendedTrackingBaseUrl(
  trackingBaseUrl?: string,
  frontendUrl?: string,
  backendUrl?: string,
): string {
  const parsedTracking = parseTrackingBaseUrl(trackingBaseUrl?.trim() ?? '');
  if (parsedTracking && !isLocalTrackingHostname(parsedTracking.hostname)) {
    const origin = parsedTracking.origin.replace(/\/$/, '');
    return origin.endsWith('/api') ? origin : `${origin}/api`;
  }

  const normalizedFrontend = frontendUrl?.trim().replace(/\/$/, '');
  if (normalizedFrontend) {
    return `${normalizedFrontend}/api`;
  }

  const normalizedBackend = backendUrl?.trim().replace(/\/$/, '');
  if (normalizedBackend) {
    return normalizedBackend;
  }

  return 'http://localhost:3008';
}

export function formatTrackingBaseUrlForDisplay(
  trackingBaseUrl: string,
): string {
  const parsed = parseTrackingBaseUrl(trackingBaseUrl);
  if (!parsed) {
    return trackingBaseUrl;
  }

  const normalized = trackingBaseUrl.trim().replace(/\/$/, '');

  if (isLocalTrackingHostname(parsed.hostname)) {
    return normalized;
  }

  if (normalized.endsWith('/api')) {
    return normalized;
  }

  return parsed.origin;
}
