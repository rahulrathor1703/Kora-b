import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';

export enum BulkAssignAbacPoliciesMode {
  Add = 'add',
  Replace = 'replace',
}

export class BulkAssignAbacPoliciesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  policyIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  userIds!: string[];

  @IsEnum(BulkAssignAbacPoliciesMode)
  mode!: BulkAssignAbacPoliciesMode;
}
