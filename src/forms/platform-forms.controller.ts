import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { UserRole } from '../users/entities/user.entity';
import { UpdateFormSchemaDto } from './dto/update-form-schema.dto';
import { FormsService } from './forms.service';

@Controller('platform/forms')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(UserRole.SUPERADMIN)
export class PlatformFormsController {
  constructor(private readonly formsService: FormsService) {}

  @Get()
  @RequirePermissions('platform:forms:read')
  listForms() {
    return this.formsService.listRegistryForPlatform();
  }

  @Get(':formKey/schema')
  @RequirePermissions('platform:forms:read')
  getPlatformSchema(@Param('formKey') formKey: string) {
    return this.formsService.getPlatformSchema(formKey);
  }

  @Put(':formKey/schema')
  @RequirePermissions('platform:forms:update')
  updatePlatformSchema(
    @Param('formKey') formKey: string,
    @Body() dto: UpdateFormSchemaDto,
  ) {
    return this.formsService.updatePlatformSchema(formKey, dto);
  }

  @Post(':formKey/publish')
  @RequirePermissions('platform:forms:update')
  publishPlatformSchema(@Param('formKey') formKey: string) {
    return this.formsService.publishPlatformSchema(formKey);
  }

  @Post(':formKey/reset')
  @RequirePermissions('platform:forms:update')
  resetPlatformSchema(@Param('formKey') formKey: string) {
    return this.formsService.resetPlatformSchema(formKey);
  }
}
