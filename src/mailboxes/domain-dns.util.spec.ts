import {
  extractDomainFromEmail,
  hasDkimRecord,
  hasDmarcRecord,
  hasSpfRecord,
  normalizeDomain,
  parseTxtRecords,
} from './domain-dns.util';

describe('domain-dns.util', () => {
  describe('normalizeDomain', () => {
    it('accepts valid domains', () => {
      expect(normalizeDomain('ebevervent.in')).toBe('ebevervent.in');
      expect(normalizeDomain('mail.company.co.uk.')).toBe('mail.company.co.uk');
    });

    it('rejects invalid domains', () => {
      expect(normalizeDomain('not-a-domain')).toBeNull();
      expect(normalizeDomain('')).toBeNull();
    });
  });

  describe('extractDomainFromEmail', () => {
    it('extracts the domain from an email address', () => {
      expect(extractDomainFromEmail('sales@ebevervent.in')).toBe(
        'ebevervent.in',
      );
    });

    it('returns null for invalid email addresses', () => {
      expect(extractDomainFromEmail('invalid')).toBeNull();
      expect(extractDomainFromEmail('@missing-local.com')).toBeNull();
    });
  });

  describe('parseTxtRecords', () => {
    it('parses Google DNS TXT answers', () => {
      const records = parseTxtRecords({
        Status: 0,
        Answer: [
          {
            name: 'ebevervent.in.',
            type: 16,
            TTL: 600,
            data: 'v=spf1 include:dc-aa8e722993._spfm.ebevervent.in ~all',
          },
          {
            name: 'ebevervent.in.',
            type: 16,
            TTL: 600,
            data: 'brevo-code:61666642d50f17620fc72c505d7ee808',
          },
        ],
      });

      expect(records).toHaveLength(2);
      expect(records[0]?.data).toContain('v=spf1');
    });
  });

  describe('record detection', () => {
    it('detects SPF, DKIM, and DMARC records', () => {
      expect(
        hasSpfRecord([
          { name: 'example.com', data: 'v=spf1 include:_spf.google.com ~all' },
        ]),
      ).toBe(true);
      expect(
        hasDkimRecord([
          {
            name: 'mail._domainkey.example.com',
            data: 'v=DKIM1; k=rsa; p=abc',
          },
        ]),
      ).toBe(true);
      expect(
        hasDmarcRecord([
          {
            name: '_dmarc.example.com',
            data: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com',
          },
        ]),
      ).toBe(true);
    });

    it('returns false when records are missing', () => {
      expect(
        hasSpfRecord([
          { name: 'example.com', data: 'google-site-verification=abc' },
        ]),
      ).toBe(false);
      expect(hasDkimRecord([])).toBe(false);
      expect(hasDmarcRecord([])).toBe(false);
    });
  });
});
