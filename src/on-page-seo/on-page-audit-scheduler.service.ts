import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnPageAuditRunnerService } from './on-page-audit-runner.service';
import {
  OnPageAuditRunsRepository,
  WebsitePropertiesRepository,
} from './on-page-seo.repository';

@Injectable()
export class OnPageAuditSchedulerService {
  private readonly logger = new Logger(OnPageAuditSchedulerService.name);
  private isProcessing = false;

  constructor(
    private readonly websitePropertiesRepository: WebsitePropertiesRepository,
    private readonly auditRunsRepository: OnPageAuditRunsRepository,
    private readonly auditRunner: OnPageAuditRunnerService,
  ) {}

  @Cron('10 9 1 * *')
  async handleMonthlyAudits(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      const properties = await this.websitePropertiesRepository.findAllActive();

      for (const property of properties) {
        try {
          const run = this.auditRunsRepository.create({
            organizationId: property.organizationId,
            websitePropertyId: property.id,
            status: 'pending',
          });
          const savedRun = await this.auditRunsRepository.save(run);
          this.auditRunner.startRunAsync(savedRun.id, property);
        } catch (error) {
          this.logger.error(
            `Scheduled audit failed for property ${property.id}`,
            error instanceof Error ? error.stack : undefined,
          );
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}
