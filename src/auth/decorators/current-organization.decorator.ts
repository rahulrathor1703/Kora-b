import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface OrganizationAwareRequest extends Request {
  organizationId?: string | null;
}

export const CurrentOrganizationId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest<OrganizationAwareRequest>();
    return request.organizationId ?? null;
  },
);
