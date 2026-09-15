import { BadRequestException } from '@nestjs/common';
import type { OrgLimitKey } from './org-entitlements.registry';

export interface OrgLimitReachedPayload {
  code: 'ORG_LIMIT_REACHED';
  limitKey: OrgLimitKey;
  effectiveLimit: number;
  currentUsage: number;
  message: string;
}

export class OrgLimitReachedException extends BadRequestException {
  constructor(
    limitKey: OrgLimitKey,
    effectiveLimit: number,
    currentUsage: number,
    label: string,
  ) {
    const payload: OrgLimitReachedPayload = {
      code: 'ORG_LIMIT_REACHED',
      limitKey,
      effectiveLimit,
      currentUsage,
      message: `${label} limit reached (${currentUsage}/${effectiveLimit}). Contact your administrator.`,
    };

    super(payload);
  }
}
