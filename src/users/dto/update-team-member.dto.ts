import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  hierarchyLevel?: number;
}

export class UpdateTeamMemberStatusDto {
  @IsIn(['active', 'disabled'])
  status!: 'active' | 'disabled';
}
