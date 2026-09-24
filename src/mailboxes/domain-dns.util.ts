const GOOGLE_DNS_BASE_URL = 'https://dns.google/resolve';

const DKIM_SELECTORS = [
  'default',
  'google',
  'selector1',
  'selector2',
  'k1',
  'mail',
  'dkim',
  's1',
  's2',
  'brevo',
  'key1',
  'key2',
  'smtp',
  'send',
  'mx',
] as const;

export interface DomainDnsTxtRecord {
  name: string;
  data: string;
}

export interface GoogleDnsResponse {
  Status: number;
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
}

export interface DomainDnsCheckResult {
  domain: string;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
}

const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export function normalizeDomain(domain: string): string | null {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, '');

  if (!normalized || !DOMAIN_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

export function extractDomainFromEmail(email: string): string | null {
  const atIndex = email.lastIndexOf('@');

  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return null;
  }

  return normalizeDomain(email.slice(atIndex + 1));
}

function unwrapTxtData(data: string): string {
  return data.replace(/^"|"$/g, '').replace(/"\s+"/g, '');
}

export function parseTxtRecords(
  response: GoogleDnsResponse,
): DomainDnsTxtRecord[] {
  if (response.Status !== 0 || !response.Answer?.length) {
    return [];
  }

  return response.Answer.filter((record) => record.type === 16).map(
    (record) => ({
      name: record.name.replace(/\.$/, '').toLowerCase(),
      data: unwrapTxtData(record.data),
    }),
  );
}

export function hasSpfRecord(records: DomainDnsTxtRecord[]): boolean {
  return records.some((record) =>
    record.data.toLowerCase().startsWith('v=spf1'),
  );
}

export function hasDmarcRecord(records: DomainDnsTxtRecord[]): boolean {
  return records.some((record) =>
    record.data.toLowerCase().startsWith('v=dmarc1'),
  );
}

export function hasDkimRecord(records: DomainDnsTxtRecord[]): boolean {
  return records.some((record) =>
    record.data.toLowerCase().includes('v=dkim1'),
  );
}

export async function fetchGoogleDnsTxt(
  name: string,
): Promise<DomainDnsTxtRecord[]> {
  const url = new URL(GOOGLE_DNS_BASE_URL);
  url.searchParams.set('name', name);
  url.searchParams.set('type', 'TXT');

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/dns-json' },
  });

  if (!response.ok) {
    throw new Error(`DNS lookup failed for ${name}`);
  }

  const payload = (await response.json()) as GoogleDnsResponse;
  return parseTxtRecords(payload);
}

export async function checkDomainDns(
  domain: string,
): Promise<DomainDnsCheckResult> {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain) {
    return {
      domain: domain.trim().toLowerCase(),
      spf: false,
      dkim: false,
      dmarc: false,
    };
  }

  const [rootRecords, dmarcRecords, ...dkimLookups] = await Promise.all([
    fetchGoogleDnsTxt(normalizedDomain),
    fetchGoogleDnsTxt(`_dmarc.${normalizedDomain}`),
    ...DKIM_SELECTORS.map((selector) =>
      fetchGoogleDnsTxt(`${selector}._domainkey.${normalizedDomain}`),
    ),
  ]);

  const dkimRecords = dkimLookups.flat();

  return {
    domain: normalizedDomain,
    spf: hasSpfRecord(rootRecords),
    dkim: hasDkimRecord(dkimRecords),
    dmarc: hasDmarcRecord(dmarcRecords),
  };
}
