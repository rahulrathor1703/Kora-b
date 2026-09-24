import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Request } from 'express';
import { AbacGuard } from '../abac/abac-evaluation.service';
import type { AuthUserProfile } from '../auth/auth.service';
import { CurrentOrganizationId } from '../auth/decorators/current-organization.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  OrganizationGuard,
  PermissionsGuard,
} from '../auth/guards/permissions.guard';
import { ContactListsService } from './contact-lists.service';
import {
  AppendContactListImportDto,
  ContactListMembersQueryDto,
  CreateContactListMemberDto,
} from './dto/contact-list-detail.dto';
import { CreateContactListImportDto } from './dto/create-contact-list-import.dto';
import {
  ContactListEnrollmentOptionsQueryDto,
  EnrollContactListMembersDto,
  RemoveContactListMemberDto,
} from './dto/list-member-campaign-sync.dto';

interface AuthenticatedRequest extends Request {
  user?: AuthUserProfile;
}

@Controller('contact-lists')
export class ContactListsController {
  constructor(private readonly contactListsService: ContactListsService) {}

  @Get()
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:read')
  findAll(@CurrentOrganizationId() organizationId: string | null) {
    return this.contactListsService.findAll(organizationId);
  }

  @Post('import/preview')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:create')
  @UseInterceptors(FileInterceptor('file'))
  previewImport(@UploadedFile() file: Express.Multer.File) {
    return this.contactListsService.previewImport(file);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:create')
  @UseInterceptors(FileInterceptor('file'))
  async importList(
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!payloadJson) {
      throw new BadRequestException('Import payload is required');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(CreateContactListImportDto, parsedPayload);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.contactListsService.importList(
      dto,
      file,
      organizationId,
      req.user,
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:read')
  findById(
    @Param('id') id: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.contactListsService.findById(id, organizationId);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:read')
  findMembers(
    @Param('id') id: string,
    @Query() query: ContactListMembersQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.contactListsService.findMembers(id, query, organizationId);
  }

  @Get(':id/members/enrollment-options')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:read')
  getEnrollmentOptions(
    @Param('id') id: string,
    @Query() query: ContactListEnrollmentOptionsQueryDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    const emails = query.emails
      ? query.emails.split(',').map((email) => email.trim())
      : [];

    return this.contactListsService.getEnrollmentOptions(
      id,
      emails,
      organizationId,
    );
  }

  @Post(':id/members/enroll-in-campaigns')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update', 'email-campaigns:update')
  enrollMembersInCampaigns(
    @Param('id') id: string,
    @Body() dto: EnrollContactListMembersDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.contactListsService.enrollMembersInCampaigns(
      id,
      dto,
      organizationId,
      req.user,
    );
  }

  @Post(':id/members')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update')
  addMember(
    @Param('id') id: string,
    @Body() dto: CreateContactListMemberDto,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.contactListsService.addMember(id, dto, organizationId);
  }

  @Get(':id/members/:memberId/removal-preview')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:read')
  getMemberRemovalPreview(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.contactListsService.getMemberRemovalPreview(
      id,
      memberId,
      organizationId,
    );
  }

  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update')
  removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: RemoveContactListMemberDto,
    @CurrentOrganizationId() organizationId: string | null,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return this.contactListsService.removeMember(
      id,
      memberId,
      dto,
      organizationId,
      req.user,
    );
  }

  @Post(':id/import/preview')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update')
  @UseInterceptors(FileInterceptor('file'))
  previewAppendImport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    return this.contactListsService.previewAppendImport(
      id,
      file,
      organizationId,
    );
  }

  @Post(':id/import')
  @UseGuards(JwtAuthGuard, OrganizationGuard, PermissionsGuard, AbacGuard)
  @RequirePermissions('contact-lists:update')
  @UseInterceptors(FileInterceptor('file'))
  async appendImport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('payload') payloadJson: string,
    @CurrentOrganizationId() organizationId: string | null,
  ) {
    if (!payloadJson) {
      throw new BadRequestException('Import payload is required');
    }

    let parsedPayload: unknown;

    try {
      parsedPayload = JSON.parse(payloadJson) as unknown;
    } catch {
      throw new BadRequestException('Import payload must be valid JSON');
    }

    const dto = plainToInstance(AppendContactListImportDto, parsedPayload);
    const validationErrors = await validate(dto);

    if (validationErrors.length > 0) {
      throw new BadRequestException(validationErrors);
    }

    return this.contactListsService.appendImport(id, dto, file, organizationId);
  }
}
