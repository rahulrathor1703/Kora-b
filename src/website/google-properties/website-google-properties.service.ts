import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Ga4PropertyCandidate,
  GooglePropertySuggestionsDto,
  GscSiteCandidate,
} from '../types/website.types';
import { WebsiteGoogleConnectionOAuthService } from '../google-connection/website-google-connection-oauth.service';

interface Ga4AccountSummaryResponse {
  accountSummaries?: Array<{
    account?: string;
    displayName?: string;
    propertySummaries?: Array<{
      property?: string;
      displayName?: string;
    }>;
  }>;
}

interface GscSitesResponse {
  siteEntry?: Array<{
    siteUrl?: string;
    permissionLevel?: string;
  }>;
}

@Injectable()
export class WebsiteGooglePropertiesService {
  constructor(
    private readonly googleOAuthService: WebsiteGoogleConnectionOAuthService,
  ) {}

  async getSuggestions(
    organizationId: string,
    url: string,
    target: { propertyId?: string; connectionId?: string },
  ): Promise<GooglePropertySuggestionsDto> {
    const normalizedDomain = this.normalizeDomain(url);
    if (!normalizedDomain) {
      throw new BadRequestException('A valid website URL is required');
    }

    let accessToken: string;

    try {
      if (target.propertyId) {
        await this.googleOAuthService.getConnection(
          target.propertyId,
          organizationId,
        );
        accessToken = await this.googleOAuthService.getValidAccessToken(
          target.propertyId,
        );
      } else if (target.connectionId) {
        accessToken =
          await this.googleOAuthService.getValidAccessTokenForConnection(
            target.connectionId,
            organizationId,
          );
      } else {
        throw new BadRequestException('propertyId or connectionId is required');
      }
    } catch {
      throw new NotFoundException(
        'Google account is not connected. Connect Google to fetch property suggestions.',
      );
    }

    const [ga4Candidates, gscCandidates] = await Promise.all([
      this.fetchGa4Properties(accessToken),
      this.fetchGscSites(accessToken),
    ]);

    return {
      ga4: {
        suggested: this.matchGa4Property(ga4Candidates, normalizedDomain),
        candidates: ga4Candidates,
      },
      gsc: {
        suggested: this.matchGscSite(gscCandidates, normalizedDomain),
        candidates: gscCandidates,
      },
    };
  }

  private async fetchGa4Properties(
    accessToken: string,
  ): Promise<Ga4PropertyCandidate[]> {
    const response = await fetch(
      'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to fetch GA4 properties from Google',
      );
    }

    const data = (await response.json()) as Ga4AccountSummaryResponse;
    const candidates: Ga4PropertyCandidate[] = [];

    for (const account of data.accountSummaries ?? []) {
      const accountName = account.displayName ?? account.account ?? 'Account';

      for (const property of account.propertySummaries ?? []) {
        if (!property.property) {
          continue;
        }

        candidates.push({
          propertyId: property.property,
          propertyName: property.displayName ?? property.property,
          accountName,
        });
      }
    }

    return candidates;
  }

  private async fetchGscSites(
    accessToken: string,
  ): Promise<GscSiteCandidate[]> {
    const response = await fetch(
      'https://www.googleapis.com/webmasters/v3/sites',
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        'Failed to fetch Search Console sites from Google',
      );
    }

    const data = (await response.json()) as GscSitesResponse;

    return (data.siteEntry ?? [])
      .filter((entry) => entry.siteUrl)
      .map((entry) => ({
        siteUrl: entry.siteUrl!,
        permissionLevel: entry.permissionLevel ?? 'unknown',
      }));
  }

  private matchGa4Property(
    candidates: Ga4PropertyCandidate[],
    domain: string,
  ): Ga4PropertyCandidate | null {
    let best: Ga4PropertyCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.scoreDomainMatch(
        domain,
        candidate.propertyName,
        candidate.accountName,
      );

      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return bestScore >= 50 ? best : null;
  }

  private matchGscSite(
    candidates: GscSiteCandidate[],
    domain: string,
  ): GscSiteCandidate | null {
    let best: GscSiteCandidate | null = null;
    let bestScore = 0;

    for (const candidate of candidates) {
      const score = this.scoreGscSiteMatch(domain, candidate.siteUrl);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    return bestScore >= 50 ? best : null;
  }

  private scoreGscSiteMatch(domain: string, siteUrl: string): number {
    const normalizedSite = siteUrl.toLowerCase();

    if (normalizedSite === `sc-domain:${domain}`) {
      return 100;
    }

    if (normalizedSite.includes(domain)) {
      return 80;
    }

    try {
      const hostname = this.normalizeDomain(siteUrl);
      if (hostname === domain) {
        return 90;
      }
    } catch {
      // ignore invalid URLs in GSC entries
    }

    return 0;
  }

  private scoreDomainMatch(domain: string, ...labels: string[]): number {
    const haystack = labels.join(' ').toLowerCase();

    if (haystack.includes(domain)) {
      return 80;
    }

    const domainRoot = domain.split('.')[0];
    if (domainRoot.length >= 3 && haystack.includes(domainRoot)) {
      return 50;
    }

    return 0;
  }

  normalizeDomain(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const withProtocol = trimmed.includes('://')
        ? trimmed
        : `https://${trimmed}`;
      const hostname = new URL(withProtocol).hostname.toLowerCase();
      return hostname.replace(/^www\./, '');
    } catch {
      const fallback = trimmed
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        ?.toLowerCase();

      return fallback && fallback.includes('.') ? fallback : null;
    }
  }
}
