export const LOCATION_COMPONENTS = [
  'city',
  'state',
  'country',
  'region',
] as const;

export type LocationComponent = (typeof LOCATION_COMPONENTS)[number];

export type LocationInputMode = 'api' | 'manual';

export const LOCATION_INPUT_MODES: LocationInputMode[] = ['api', 'manual'];

export interface LocationValue {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  region?: string | null;
}

export type BantResponsesValue = Record<string, string>;

export type FieldStoredValue =
  string | number | string[] | null | LocationValue | BantResponsesValue;

export const CONTINENT_NAMES: Record<string, string> = {
  AF: 'Africa',
  AS: 'Asia',
  EU: 'Europe',
  NA: 'North America',
  OC: 'Oceania',
  SA: 'South America',
  AN: 'Antarctica',
};

export function isLocationValue(value: unknown): value is LocationValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const allowedKeys = new Set<string>(LOCATION_COMPONENTS);

  return Object.keys(record).every(
    (key) =>
      allowedKeys.has(key) &&
      (record[key] === null ||
        record[key] === undefined ||
        typeof record[key] === 'string'),
  );
}

export function normalizeLocationComponents(
  components: LocationComponent[],
): LocationComponent[] {
  const unique = new Set<LocationComponent>();

  for (const component of components) {
    if (LOCATION_COMPONENTS.includes(component)) {
      unique.add(component);
    }
  }

  return LOCATION_COMPONENTS.filter((component) => unique.has(component));
}

export function normalizeLocationInputMode(
  mode: LocationInputMode | undefined,
): LocationInputMode {
  return mode === 'manual' ? 'manual' : 'api';
}

export function buildLocationDisplayLabel(
  value: LocationValue,
  components: LocationComponent[],
): string {
  return components
    .map((component) => value[component]?.trim())
    .filter((part): part is string => Boolean(part && part.length > 0))
    .join(', ');
}

export function emptyLocationValue(): LocationValue {
  return {
    city: null,
    state: null,
    country: null,
    region: null,
  };
}
