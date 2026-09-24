import { Injectable } from '@nestjs/common';
import { requireOrganizationId } from '../common/organization/require-organization-id';
import { ContactListsRepository } from '../contact-lists/contact-lists.repository';
import { ManualListsRepository } from '../manual-lists/manual-lists.repository';
import type {
  MergeFieldCatalogResponseDto,
  MergeFieldGroupDto,
  MergeFieldItemDto,
  MergeFieldVariantDto,
} from './dto/merge-field-catalog.dto';
import {
  MERGE_FIELD_GROUP_LABELS,
  MERGE_FIELD_STANDARD_LABELS,
  normalizeMergeFieldKey,
  resolveMergeFieldGroupId,
  type MergeFieldGroupId,
} from './merge-field-key.util';

interface RawListField {
  key: string;
  label: string;
  listId: string;
}

interface TokenAccumulator {
  token: string;
  labels: Map<string, number>;
  listIds: Set<string>;
}

const GROUP_ORDER: MergeFieldGroupId[] = [
  'name',
  'contact',
  'company',
  'location',
  'custom',
  'system',
];

const NAME_GROUP_TOKENS = ['first_name', 'last_name', 'full_name'] as const;

@Injectable()
export class CampaignMergeFieldCatalogService {
  constructor(
    private readonly contactListsRepository: ContactListsRepository,
    private readonly manualListsRepository: ManualListsRepository,
  ) {}

  async getCatalog(
    organizationId: string | null,
  ): Promise<MergeFieldCatalogResponseDto> {
    const resolvedOrganizationId = requireOrganizationId(organizationId);

    const [contactLists, manualLists] = await Promise.all([
      this.contactListsRepository.findAllByOrganizationId(
        resolvedOrganizationId,
      ),
      this.manualListsRepository.findAllByOrganizationId(
        resolvedOrganizationId,
      ),
    ]);

    const rawFields: RawListField[] = [];

    for (const list of contactLists) {
      const schema = list.fieldSchema;
      if (schema?.email?.key) {
        rawFields.push({
          key: schema.email.key,
          label: schema.email.label,
          listId: list.id,
        });
      }

      for (const field of schema?.fields ?? []) {
        rawFields.push({
          key: field.key,
          label: field.label,
          listId: list.id,
        });
      }
    }

    for (const list of manualLists) {
      for (const column of list.columns ?? []) {
        rawFields.push({
          key: column.key,
          label: column.label,
          listId: list.id,
        });
      }
    }

    const tokenMap = this.accumulateTokens(rawFields);
    this.ensureSyntheticFields(tokenMap, rawFields.length > 0);

    const groups = this.buildGroups(tokenMap);

    return { groups };
  }

  private accumulateTokens(
    rawFields: RawListField[],
  ): Map<string, TokenAccumulator> {
    const tokenMap = new Map<string, TokenAccumulator>();

    for (const field of rawFields) {
      const token = normalizeMergeFieldKey(field.key, field.label);
      const existing = tokenMap.get(token);

      if (existing) {
        existing.listIds.add(field.listId);
        existing.labels.set(
          field.label,
          (existing.labels.get(field.label) ?? 0) + 1,
        );
        continue;
      }

      tokenMap.set(token, {
        token,
        labels: new Map([[field.label, 1]]),
        listIds: new Set([field.listId]),
      });
    }

    return tokenMap;
  }

  private ensureSyntheticFields(
    tokenMap: Map<string, TokenAccumulator>,
    hasListFields: boolean,
  ): void {
    const hasFirstName = tokenMap.has('first_name');
    const hasLastName = tokenMap.has('last_name');

    if ((hasFirstName || hasLastName) && !tokenMap.has('full_name')) {
      tokenMap.set('full_name', {
        token: 'full_name',
        labels: new Map([[MERGE_FIELD_STANDARD_LABELS.full_name, 1]]),
        listIds: new Set(),
      });
    }

    tokenMap.set('sender_name', {
      token: 'sender_name',
      labels: new Map([[MERGE_FIELD_STANDARD_LABELS.sender_name, 1]]),
      listIds: new Set(),
    });

    tokenMap.set('unsubscribe', {
      token: 'unsubscribe',
      labels: new Map([[MERGE_FIELD_STANDARD_LABELS.unsubscribe, 1]]),
      listIds: new Set(),
    });

    if (!hasListFields) {
      for (const token of [
        'first_name',
        'last_name',
        'full_name',
        'email',
        'company',
        'phone',
      ] as const) {
        if (!tokenMap.has(token)) {
          tokenMap.set(token, {
            token,
            labels: new Map([[MERGE_FIELD_STANDARD_LABELS[token], 1]]),
            listIds: new Set(),
          });
        }
      }
    }
  }

  private buildGroups(
    tokenMap: Map<string, TokenAccumulator>,
  ): MergeFieldGroupDto[] {
    const groupItems = new Map<MergeFieldGroupId, MergeFieldItemDto[]>();

    for (const groupId of GROUP_ORDER) {
      groupItems.set(groupId, []);
    }

    const nameItems = this.buildNameGroupItems(tokenMap);
    groupItems.set('name', nameItems);

    const assignedTokens = new Set<string>(NAME_GROUP_TOKENS);

    for (const [token, accumulator] of tokenMap) {
      if (assignedTokens.has(token)) {
        continue;
      }

      const groupId = resolveMergeFieldGroupId(token);
      if (groupId === 'name') {
        continue;
      }

      const items = groupItems.get(groupId) ?? [];
      items.push(this.toItem(accumulator));
      groupItems.set(groupId, items);
    }

    const customItems = groupItems.get('custom') ?? [];
    groupItems.set('custom', this.mergeCustomItemsByLabel(customItems));

    return GROUP_ORDER.map((groupId) => ({
      id: groupId,
      label: MERGE_FIELD_GROUP_LABELS[groupId],
      items: this.sortGroupItems(groupId, groupItems.get(groupId) ?? []),
    })).filter((group) => group.items.length > 0);
  }

  private buildNameGroupItems(
    tokenMap: Map<string, TokenAccumulator>,
  ): MergeFieldItemDto[] {
    const presentTokens = NAME_GROUP_TOKENS.filter((token) =>
      tokenMap.has(token),
    );

    if (presentTokens.length === 0) {
      return [];
    }

    if (presentTokens.length === 1) {
      const token = presentTokens[0];
      const accumulator = tokenMap.get(token);
      return accumulator ? [this.toItem(accumulator)] : [];
    }

    return presentTokens.map((token) => {
      const accumulator = tokenMap.get(token)!;
      return this.toItem(accumulator);
    });
  }

  private toItem(accumulator: TokenAccumulator): MergeFieldItemDto {
    const label = this.resolveDisplayLabel(accumulator);
    return {
      label,
      variants: [this.toVariant(accumulator, label)],
    };
  }

  private toVariant(
    accumulator: TokenAccumulator,
    label: string,
  ): MergeFieldVariantDto {
    return {
      token: accumulator.token,
      label,
      listCount: accumulator.listIds.size,
    };
  }

  private resolveDisplayLabel(accumulator: TokenAccumulator): string {
    const standardLabel = MERGE_FIELD_STANDARD_LABELS[accumulator.token];
    if (standardLabel) {
      return standardLabel;
    }

    let bestLabel = accumulator.token;
    let bestCount = 0;

    for (const [label, count] of accumulator.labels) {
      if (count > bestCount) {
        bestLabel = label;
        bestCount = count;
      }
    }

    return bestLabel;
  }

  private mergeCustomItemsByLabel(
    items: MergeFieldItemDto[],
  ): MergeFieldItemDto[] {
    const byLabel = new Map<string, MergeFieldItemDto>();

    for (const item of items) {
      const normalizedLabel = item.label.trim().toLowerCase();
      const existing = byLabel.get(normalizedLabel);

      if (!existing) {
        byLabel.set(normalizedLabel, {
          label: item.label,
          variants: [...item.variants],
        });
        continue;
      }

      const knownTokens = new Set(
        existing.variants.map((variant) => variant.token),
      );

      for (const variant of item.variants) {
        if (knownTokens.has(variant.token)) {
          const match = existing.variants.find(
            (entry) => entry.token === variant.token,
          );
          if (match) {
            match.listCount += variant.listCount;
          }
          continue;
        }

        existing.variants.push(variant);
        knownTokens.add(variant.token);
      }
    }

    return [...byLabel.values()];
  }

  private sortGroupItems(
    groupId: MergeFieldGroupId,
    items: MergeFieldItemDto[],
  ): MergeFieldItemDto[] {
    if (groupId === 'name') {
      const order = ['First Name', 'Last Name', 'Full Name'];
      return [...items].sort(
        (left, right) => order.indexOf(left.label) - order.indexOf(right.label),
      );
    }

    return [...items].sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }),
    );
  }
}
