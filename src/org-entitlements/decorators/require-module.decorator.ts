import { SetMetadata } from '@nestjs/common';
import type { OrgModule } from '../org-entitlements.registry';

export const MODULE_KEY = 'required_module';

export const RequireModule = (module: OrgModule) =>
  SetMetadata(MODULE_KEY, module);
