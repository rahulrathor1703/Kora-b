import { ForbiddenException } from '@nestjs/common';
import type { OrgModule } from './org-entitlements.registry';

export interface ModuleDisabledPayload {
  code: 'MODULE_DISABLED';
  module: OrgModule;
  message: string;
}

export class ModuleDisabledException extends ForbiddenException {
  constructor(module: OrgModule) {
    const payload: ModuleDisabledPayload = {
      code: 'MODULE_DISABLED',
      module,
      message: `The ${module} module is not enabled for this organization.`,
    };

    super(payload);
  }
}
