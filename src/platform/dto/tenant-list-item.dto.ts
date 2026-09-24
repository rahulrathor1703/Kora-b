export class TenantListItemDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: 'active' | 'suspended';
  createdAt!: string;
  memberCount!: number;
}

export class TenantListResponseDto {
  tenants!: TenantListItemDto[];
}

export class TenantDetailResponseDto {
  id!: string;
  name!: string;
  slug!: string;
  status!: 'active' | 'suspended';
  createdAt!: string;
  memberCount!: number;
}

export class ImpersonateTenantResponseDto {
  organizationId!: string;
  name!: string;
  slug!: string;
  status!: 'active' | 'suspended';
}
