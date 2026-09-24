import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  NotionDatabaseProperty,
  NotionPageLike,
} from './notion-property.mapper';

const NOTION_API_BASE = 'https://api.notion.com';
const NOTION_VERSION = '2022-06-28';

export interface NotionDatabaseSummary {
  id: string;
  title: string;
}

export interface NotionDatabaseDetails {
  id: string;
  title: string;
  properties: NotionDatabaseProperty[];
}

interface NotionSearchResult {
  object?: string;
  id?: string;
  title?: Array<{ plain_text?: string }>;
}

interface NotionSearchResponse {
  results?: NotionSearchResult[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface NotionDatabaseResponse {
  id?: string;
  title?: Array<{ plain_text?: string }>;
  properties?: Record<string, NotionDatabaseProperty & { name?: string }>;
}

interface NotionQueryResponse {
  results?: NotionPageLike[];
  has_more?: boolean;
  next_cursor?: string | null;
}

@Injectable()
export class NotionApiClient {
  async validateToken(token: string): Promise<void> {
    const response = await this.request(token, '/v1/users/me');
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('Notion integration token is invalid.');
    }

    if (!response.ok) {
      throw new BadRequestException(
        'Unable to validate the Notion integration token.',
      );
    }
  }

  async listDatabases(token: string): Promise<NotionDatabaseSummary[]> {
    const databases: NotionDatabaseSummary[] = [];
    let startCursor: string | undefined;

    do {
      const response = await this.request(token, '/v1/search', {
        method: 'POST',
        body: JSON.stringify({
          filter: { property: 'object', value: 'database' },
          page_size: 100,
          ...(startCursor ? { start_cursor: startCursor } : {}),
        }),
      });
      const payload = await this.readJson<NotionSearchResponse>(response);
      for (const result of payload.results ?? []) {
        if (result.object !== 'database' || !result.id) {
          continue;
        }

        databases.push({
          id: result.id,
          title: this.readTitle(result.title) || 'Untitled database',
        });
      }

      startCursor = payload.has_more
        ? (payload.next_cursor ?? undefined)
        : undefined;
    } while (startCursor);

    return databases;
  }

  async getDatabase(
    token: string,
    databaseId: string,
  ): Promise<NotionDatabaseDetails> {
    const response = await this.request(
      token,
      `/v1/databases/${encodeURIComponent(databaseId)}`,
    );
    if (response.status === 404) {
      throw new BadRequestException(
        'Notion database was not found. Share it with the integration.',
      );
    }

    const payload = await this.readJson<NotionDatabaseResponse>(response);
    const properties = Object.entries(payload.properties ?? {}).map(
      ([name, property]) => ({
        id: property.id,
        name: property.name ?? name,
        type: property.type,
        select: property.select,
        multi_select: property.multi_select,
        status: property.status,
      }),
    );

    return {
      id: payload.id ?? databaseId,
      title: this.readTitle(payload.title) || 'Untitled database',
      properties,
    };
  }

  async queryAllPages(
    token: string,
    databaseId: string,
  ): Promise<NotionPageLike[]> {
    const pages: NotionPageLike[] = [];
    let startCursor: string | undefined;

    do {
      const response = await this.request(
        token,
        `/v1/databases/${encodeURIComponent(databaseId)}/query`,
        {
          method: 'POST',
          body: JSON.stringify({
            page_size: 100,
            ...(startCursor ? { start_cursor: startCursor } : {}),
          }),
        },
      );
      const payload = await this.readJson<NotionQueryResponse>(response);
      for (const page of payload.results ?? []) {
        if (page.properties) {
          pages.push({
            properties: page.properties,
          });
        }
      }

      startCursor = payload.has_more
        ? (payload.next_cursor ?? undefined)
        : undefined;
    } while (startCursor);

    return pages;
  }

  private async request(
    token: string,
    path: string,
    init: RequestInit = {},
  ): Promise<Response> {
    return fetch(`${NOTION_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...(init.headers ?? {}),
      },
    });
  }

  private async readJson<T>(response: Response): Promise<T> {
    if (response.status === 401 || response.status === 403) {
      throw new BadRequestException('Notion integration token is invalid.');
    }

    if (!response.ok) {
      throw new BadRequestException(
        'Notion request failed. Check the integration token and database access.',
      );
    }

    return (await response.json()) as T;
  }

  private readTitle(title: Array<{ plain_text?: string }> | undefined): string {
    return (title ?? [])
      .map((part) => part.plain_text ?? '')
      .join('')
      .trim();
  }
}
