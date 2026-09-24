import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { EmailInboxQueryDto } from './dto/email-inbox-query.dto';
import { MarkInboxReplyDoneDto } from './dto/mark-inbox-reply-done.dto';
import { EmailInboxService } from './email-inbox.service';

@Controller('email-inbox')
export class EmailInboxController {
  constructor(private readonly emailInboxService: EmailInboxService) {}

  @Get('replies')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:read')
  listReplies(
    @CurrentOrganizationId() organizationId: string | null,
    @Query() query: EmailInboxQueryDto,
  ) {
    return this.emailInboxService.listReplies(organizationId, query);
  }

  @Post('replies/:recipientId/mark-done')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('email-campaigns:update')
  markReplyAsDone(
    @CurrentOrganizationId() organizationId: string | null,
    @Param('recipientId') recipientId: string,
    @Body() dto: MarkInboxReplyDoneDto,
  ) {
    return this.emailInboxService.markReplyAsDone(
      organizationId,
      recipientId,
      dto,
    );
  }
}
