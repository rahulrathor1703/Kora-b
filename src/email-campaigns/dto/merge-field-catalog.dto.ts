export interface MergeFieldVariantDto {
  token: string;
  label: string;
  listCount: number;
}

export interface MergeFieldItemDto {
  label: string;
  variants: MergeFieldVariantDto[];
}

export interface MergeFieldGroupDto {
  id: string;
  label: string;
  items: MergeFieldItemDto[];
}

export interface MergeFieldCatalogResponseDto {
  groups: MergeFieldGroupDto[];
}
