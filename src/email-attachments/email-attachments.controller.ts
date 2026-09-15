import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequireAnyPermissions } from '../auth/decorators/require-any-permissions.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { RequireModule } from '../org-entitlements/decorators/require-module.decorator';
import { ModuleAccessGuard } from '../org-entitlements/guards/module-access.guard';
import { EmailAttachmentsService } from './email-attachments.service';

@Controller()
@UseGuards(JwtAuthGuard, OrganizationGuard, ModuleAccessGuard)
@RequireModule('email')
export class EmailAttachmentsController {
  constructor(
    private readonly emailAttachmentsService: EmailAttachmentsService,
  ) {}

  @Get('email-campaigns/:campaignId/steps/:stepOrder/attachments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('email-campaigns:read')
  listCampaignStepAttachments(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('campaignId') campaignId: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
  ) {
    return this.emailAttachmentsService.listCampaignStepAttachments(
      this.requireOrganizationId(organizationId),
      campaignId,
      stepOrder,
    );
  }

  @Post('email-campaigns/:campaignId/steps/:stepOrder/attachments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('email-campaigns:update')
  @UseInterceptors(FileInterceptor('file'))
  uploadCampaignStepAttachment(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('campaignId') campaignId: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.emailAttachmentsService.uploadCampaignStepAttachment(
      this.requireOrganizationId(organizationId),
      campaignId,
      stepOrder,
      file,
    );
  }

  @Post(
    'email-campaigns/:campaignId/steps/:stepOrder/attachments/copy-from-template/:templateStepId',
  )
  @UseGuards(PermissionsGuard)
  @RequirePermissions('email-campaigns:update')
  copyTemplateAttachmentsToCampaignStep(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('campaignId') campaignId: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @Param('templateStepId') templateStepId: string,
  ) {
    return this.emailAttachmentsService.copyTemplateAttachmentsToCampaignStepByOrder(
      this.requireOrganizationId(organizationId),
      campaignId,
      stepOrder,
      templateStepId,
    );
  }

  @Get('email-templates/:templateId/steps/:stepOrder/attachments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('email-templates:read')
  listTemplateStepAttachments(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('templateId') templateId: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
  ) {
    return this.emailAttachmentsService.listTemplateStepAttachments(
      this.requireOrganizationId(organizationId),
      templateId,
      stepOrder,
    );
  }

  @Post('email-templates/:templateId/steps/:stepOrder/attachments')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('email-templates:update')
  @UseInterceptors(FileInterceptor('file'))
  uploadTemplateStepAttachment(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('templateId') templateId: string,
    @Param('stepOrder', ParseIntPipe) stepOrder: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.emailAttachmentsService.uploadTemplateStepAttachment(
      this.requireOrganizationId(organizationId),
      templateId,
      stepOrder,
      file,
    );
  }

  @Delete('email-attachments/:id')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermissions('email-campaigns:update', 'email-templates:update')
  deleteAttachment(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('id') attachmentId: string,
  ) {
    return this.emailAttachmentsService.deleteAttachment(
      this.requireOrganizationId(organizationId),
      attachmentId,
    );
  }

  private requireOrganizationId(organizationId: string | null): string {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    return organizationId;
  }
}
