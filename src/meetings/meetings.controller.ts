import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import { AuthUser } from '../auth/auth.types';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import {
  CreateMeetingDto,
  MeetingsCalendarQueryDto,
  MeetingsQueryDto,
} from './dto/meeting.dto';
import { MeetingsService } from './meetings.service';

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

@Controller('meetings')
@UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  @RequirePermissions('meetings:read')
  findMeetings(
    @Query() query: MeetingsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.meetingsService.findMeetings(query, organizationId);
  }

  @Get('calendar')
  @RequirePermissions('meetings:read')
  findCalendarMeetings(
    @Query() query: MeetingsCalendarQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.meetingsService.findCalendarMeetings(query, organizationId);
  }

  @Get('summary')
  @RequirePermissions('meetings:read')
  getSummary(@CurrentOrganizationId() organizationId: string | null) {
    return this.meetingsService.getSummary(organizationId);
  }

  @Post()
  @RequirePermissions('meetings:create')
  create(
    @Body() dto: CreateMeetingDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.meetingsService.create(dto, organizationId, user.id);
  }

  @Patch(':id/cancel')
  @RequirePermissions('meetings:update')
  cancel(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = this.requireUser(req);
    return this.meetingsService.cancel(id, organizationId, user.id);
  }

  private requireUser(req: AuthenticatedRequest): AuthUser {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return req.user;
  }
}
