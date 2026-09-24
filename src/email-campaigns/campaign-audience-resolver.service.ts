import { Injectable } from '@nestjs/common';
import { normalizeMergeFieldKey } from './merge-field-key.util';

export interface ResolvedCampaignRecipient {
  email: string;
  mergeFields: Record<string, string>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class CampaignAudienceResolverService {
  resolveContactListMembers(
    members: Array<{
      email: string;
      firstName: string | null;
      lastName: string | null;
      company: string | null;
      phone: string | null;
      customFields: Record<string, string>;
    }>,
  ): ResolvedCampaignRecipient[] {
    const recipients: ResolvedCampaignRecipient[] = [];
    const seen = new Set<string>();

    for (const member of members) {
      const email = member.email.trim().toLowerCase();
      if (!EMAIL_PATTERN.test(email) || seen.has(email)) {
        continue;
      }

      seen.add(email);
      recipients.push({
        email,
        mergeFields: {
          email,
          first_name: member.firstName?.trim() ?? '',
          last_name: member.lastName?.trim() ?? '',
          full_name: [member.firstName, member.lastName]
            .filter(Boolean)
            .join(' ')
            .trim(),
          company: member.company?.trim() ?? '',
          phone: member.phone?.trim() ?? '',
          ...member.customFields,
        },
      });
    }

    return recipients;
  }

  resolveManualListRows(
    columns: Array<{ key: string; label: string }>,
    rows: Array<{ data: Record<string, string> }>,
  ): ResolvedCampaignRecipient[] {
    const emailColumnKey = this.findEmailColumnKey(columns);
    const recipients: ResolvedCampaignRecipient[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const email = this.resolveEmailFromRow(row.data, emailColumnKey);
      if (!email || seen.has(email)) {
        continue;
      }

      seen.add(email);
      const mergeFields: Record<string, string> = { email };

      for (const column of columns) {
        const normalizedKey = normalizeMergeFieldKey(column.key, column.label);
        mergeFields[normalizedKey] = row.data[column.key]?.trim() ?? '';
      }

      recipients.push({ email, mergeFields });
    }

    return recipients;
  }

  private findEmailColumnKey(
    columns: Array<{ key: string; label: string }>,
  ): string | null {
    const emailColumn = columns.find(
      (column) => /^email$/i.test(column.key) || /^email$/i.test(column.label),
    );

    return emailColumn?.key ?? null;
  }

  private resolveEmailFromRow(
    data: Record<string, string>,
    emailColumnKey: string | null,
  ): string | null {
    if (emailColumnKey) {
      const candidate = data[emailColumnKey]?.trim().toLowerCase();
      if (candidate && EMAIL_PATTERN.test(candidate)) {
        return candidate;
      }
    }

    for (const value of Object.values(data)) {
      const candidate = value?.trim().toLowerCase();
      if (candidate && EMAIL_PATTERN.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }
}
