import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AbacModule } from '../abac/abac.module';
import { AuthModule } from '../auth/auth.module';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { RbacModule } from '../rbac/rbac.module';
import { WebsiteModule } from '../website/website.module';
import { OnPageAuditRunEntity } from './entities/on-page-audit-run.entity';
import { OnPagePageResultEntity } from './entities/on-page-page-result.entity';
import { WebsitePropertyEntity } from './entities/website-property.entity';
import { OnPageAuditRunnerService } from './on-page-audit-runner.service';
import { OnPageAuditSchedulerService } from './on-page-audit-scheduler.service';
import { OnPageHtmlParserService } from './on-page-html-parser.service';
import { OnPageSeoController } from './on-page-seo.controller';
import { OnPageSeoMapper } from './on-page-seo.mapper';
import {
  OnPageAuditRunsRepository,
  OnPagePageResultsRepository,
  WebsitePropertiesRepository,
} from './on-page-seo.repository';
import {
  OnPageAuditsService,
  WebsitePropertiesService,
} from './on-page-seo.service';
import {
  PageFetcherService,
  SitemapFetcherService,
} from './page-fetcher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebsitePropertyEntity,
      OnPageAuditRunEntity,
      OnPagePageResultEntity,
    ]),
    ScheduleModule.forRoot(),
    RbacModule,
    WebsiteModule,
    forwardRef(() => AuthModule),
    forwardRef(() => AbacModule),
    OrgEntitlementsModule,
  ],
  controllers: [OnPageSeoController],
  providers: [
    WebsitePropertiesRepository,
    OnPageAuditRunsRepository,
    OnPagePageResultsRepository,
    WebsitePropertiesService,
    OnPageAuditsService,
    OnPageAuditRunnerService,
    OnPageAuditSchedulerService,
    OnPageHtmlParserService,
    PageFetcherService,
    SitemapFetcherService,
    OnPageSeoMapper,
  ],
  exports: [WebsitePropertiesService, OnPageAuditsService],
})
export class OnPageSeoModule {}
