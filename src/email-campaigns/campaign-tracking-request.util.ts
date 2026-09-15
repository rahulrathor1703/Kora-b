import type { Request } from 'express';

export interface ClickTrackingRequestContext {
  userAgent?: string;
  ipAddress?: string;
}

export interface ResolveClickRedirectInput {
  linkIndex?: number;
  sig?: string;
  userAgent?: string;
  ipAddress?: string;
}

export function extractClickTrackingRequestContext(
  request: Request,
): ClickTrackingRequestContext {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedIp =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : undefined;

  const userAgentHeader = request.headers['user-agent'];

  return {
    userAgent:
      typeof userAgentHeader === 'string' ? userAgentHeader : undefined,
    ipAddress: forwardedIp || request.ip || undefined,
  };
}

export function parseClickLinkIndex(
  linkIndexQuery: string | undefined,
): number | undefined {
  if (linkIndexQuery === undefined || linkIndexQuery.trim() === '') {
    return undefined;
  }

  const parsed = Number.parseInt(linkIndexQuery, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return undefined;
  }

  return parsed;
}
