import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class AssignUserPoliciesDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  policyIds!: string[];
}
