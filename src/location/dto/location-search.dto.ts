import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  LOCATION_COMPONENTS,
  normalizeLocationComponents,
  type LocationComponent,
} from '../../common/location/location-field.types';

export class LocationSearchQueryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @Transform(({ value }) => normalizeLocationComponents(parseComponents(value)))
  components!: LocationComponent[];

  @IsIn(LOCATION_COMPONENTS)
  trigger!: LocationComponent;
}

function parseComponents(value: unknown): LocationComponent[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part): part is LocationComponent =>
      LOCATION_COMPONENTS.includes(part as LocationComponent),
    );
}

export class LocationSearchStatusQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  configuredOnly?: boolean;
}
