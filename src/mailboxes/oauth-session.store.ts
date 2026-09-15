import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { MailboxCredentials } from './providers/mailbox-provider.types';

export interface OAuthSession {
  provider: 'gmail' | 'outlook';
  email: string;
  credentials: MailboxCredentials;
  organizationId: string;
  userId: string;
  expiresAt: number;
}

@Injectable()
export class OAuthSessionStore {
  private readonly sessions = new Map<string, OAuthSession>();
  private readonly ttlMs = 10 * 60 * 1000;

  create(session: Omit<OAuthSession, 'expiresAt'>): string {
    this.cleanupExpired();
    const token = randomUUID();
    this.sessions.set(token, {
      ...session,
      expiresAt: Date.now() + this.ttlMs,
    });
    return token;
  }

  consume(token: string): OAuthSession | null {
    this.cleanupExpired();
    const session = this.sessions.get(token);
    if (!session) {
      return null;
    }

    this.sessions.delete(token);
    if (session.expiresAt <= Date.now()) {
      return null;
    }

    return session;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }
}
