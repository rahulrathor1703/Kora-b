import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { from, Observable } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import type { AuthUserProfile } from '../auth/auth.service';
import { getActiveOrganizationId } from '../common/organization/organization.context';
import {
  formatActorName,
  matchAuditLogRoute,
  resolveAuditLogMessage,
  sanitizeQuery,
  shouldSkipAuditLog,
} from './audit-log-message.resolver';
import { AuditLogResourceLabelService } from './audit-log-resource-label.service';
import { AuditLogsService } from './audit-logs.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogsService: AuditLogsService,
    private readonly resourceLabelService: AuditLogResourceLabelService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const path = request.path;
    const method = request.method;

    if (shouldSkipAuditLog(path, method, Boolean(request.user))) {
      return next.handle();
    }

    const routeMatch = matchAuditLogRoute(method, path);
    const organizationId =
      getActiveOrganizationId() ?? request.user?.organizationId ?? null;
    const isDelete = method.toUpperCase() === 'DELETE';

    const runWithLabel = (prefetchedLabel: string | null) =>
      next.handle().pipe(
        mergeMap((responseBody: unknown) =>
          from(
            this.record(
              request,
              response,
              startedAt,
              path,
              method,
              responseBody,
              prefetchedLabel,
            ),
          ).pipe(map((): unknown => responseBody)),
        ),
        catchError((error: unknown) =>
          from(
            this.record(
              request,
              response,
              startedAt,
              path,
              method,
              null,
              prefetchedLabel,
            ),
          ).pipe(
            mergeMap(() => {
              throw error;
            }),
          ),
        ),
      );

    if (isDelete && routeMatch) {
      return from(
        this.resourceLabelService.resolveLabel({
          resourceType: routeMatch.resourceType,
          resourceId: routeMatch.resourceId,
          action: 'delete',
          path,
          organizationId,
          responseBody: null,
          requestBody: request.body,
        }),
      ).pipe(mergeMap((prefetchedLabel) => runWithLabel(prefetchedLabel)));
    }

    return runWithLabel(null);
  }

  private async record(
    request: AuthenticatedRequest,
    response: Response,
    startedAt: number,
    path: string,
    method: string,
    responseBody: unknown,
    prefetchedLabel: string | null,
  ): Promise<void> {
    const user = request.user;
    if (!user) {
      return;
    }

    const organizationId =
      getActiveOrganizationId() ?? user.organizationId ?? null;
    const routeMatch = matchAuditLogRoute(method, path);
    const resolvedAction = routeMatch?.action ?? 'other';

    try {
      const resourceLabel =
        prefetchedLabel ??
        (await this.resourceLabelService.resolveLabel({
          resourceType: routeMatch?.resourceType ?? null,
          resourceId: routeMatch?.resourceId ?? null,
          action: resolvedAction,
          path,
          organizationId,
          responseBody,
          requestBody: request.body,
        }));

      const actorName = formatActorName(user.username, user.email);
      const resolved = resolveAuditLogMessage(
        method,
        path,
        actorName,
        resourceLabel,
      );

      this.auditLogsService.recordAsync({
        organizationId,
        actorUserId: user.id,
        actorName,
        actorEmail: user.email,
        module: resolved.module,
        action: resolved.action,
        httpMethod: method.toUpperCase(),
        requestPath: path,
        statusCode: response.statusCode,
        message: resolved.message,
        resourceType: resolved.resourceType,
        resourceId: resolved.resourceId,
        metadata: {
          durationMs: Date.now() - startedAt,
          query: sanitizeQuery(request.query),
          ip: request.ip,
          userAgent:
            typeof request.headers['user-agent'] === 'string'
              ? request.headers['user-agent']
              : undefined,
          resourceLabel: resourceLabel ?? undefined,
        },
      });
    } catch {
      // Audit logging must never break the API response.
    }
  }
}
