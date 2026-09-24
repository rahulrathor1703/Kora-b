import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailCampaignsModule } from '../email-campaigns/email-campaigns.module';
import { EmailTemplatesModule } from '../email-templates/email-templates.module';
import { OrgEntitlementsModule } from '../org-entitlements/org-entitlements.module';
import { EmailAttachmentsController } from './email-attachments.controller';
import { EmailAttachmentsRepository } from './email-attachments.repository';
import { EmailAttachmentsService } from './email-attachments.service';
import { EmailStepAttachmentEntity } from './entities/email-step-attachment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailStepAttachmentEntity]),
    forwardRef(() => EmailCampaignsModule),
    forwardRef(() => EmailTemplatesModule),
    OrgEntitlementsModule,
  ],
  controllers: [EmailAttachmentsController],
  providers: [EmailAttachmentsRepository, EmailAttachmentsService],
  exports: [EmailAttachmentsService, EmailAttachmentsRepository],
})
export class EmailAttachmentsModule {}
