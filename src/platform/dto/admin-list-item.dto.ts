export class AdminListItemDto {
  id!: string;
  email!: string;
  createdAt!: string;
}

export class AdminListResponseDto {
  admins!: AdminListItemDto[];
}
