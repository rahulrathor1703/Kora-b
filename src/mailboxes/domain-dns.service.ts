import { BadRequestException, Injectable } from '@nestjs/common';
import {
  checkDomainDns,
  extractDomainFromEmail,
  normalizeDomain,
  type DomainDnsCheckResult,
} from './domain-dns.util';

@Injectable()
export class DomainDnsService {
  async checkDomain(domain: string): Promise<DomainDnsCheckResult> {
    const normalizedDomain = normalizeDomain(domain);

    if (!normalizedDomain) {
      throw new BadRequestException('Enter a valid domain name.');
    }

    return checkDomainDns(normalizedDomain);
  }

  async checkEmailDomain(email: string): Promise<DomainDnsCheckResult> {
    const domain = extractDomainFromEmail(email);

    if (!domain) {
      throw new BadRequestException('Enter a valid email address.');
    }

    return checkDomainDns(domain);
  }
}
