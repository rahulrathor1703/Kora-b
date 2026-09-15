import { Injectable, Logger } from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import type { AuditLogRecordInput, AuditLogsQuery } from './audit-log.types';
import { AuditLogsRepository } from './audit-logs.repository';
import type { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(private readonly auditLogsRepository: AuditLogsRepository) {}

  recordAsync(input: AuditLogRecordInput): void {
    void this.record(input).catch((error: unknown) => {
      this.logger.error(
        'Failed to persist audit log entry',
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  async record(input: AuditLogRecordInput): Promise<void> {
    const entity = this.auditLogsRepository.create(input);
    await this.auditLogsRepository.save(entity);
  }

  async listForOrganization(
    query: AuditLogsQueryDto,
    organizationId: string | null,
  ) {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    return this.auditLogsRepository.findPaginated(
      this.toQuery(query, resolvedOrganizationId, false),
    );
  }

  async listForPlatform(query: AuditLogsQueryDto) {
    return this.auditLogsRepository.findPaginated(
      this.toQuery(query, query.organizationId ?? null, true),
    );
  }

  private toQuery(
    dto: AuditLogsQueryDto,
    organizationId: string | null,
    platformScope: boolean,
  ): AuditLogsQuery {
    return {
      page: dto.page ?? 1,
      limit: dto.limit ?? 50,
      module: dto.module,
      action: dto.action,
      httpMethod: dto.httpMethod,
      actorUserId: dto.actorUserId,
      search: dto.search,
      from: dto.from ? new Date(dto.from) : undefined,
      to: dto.to ? new Date(dto.to) : undefined,
      organizationId,
      platformScope,
    };
  }
}
