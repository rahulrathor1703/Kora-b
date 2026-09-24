import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

@Injectable()
export class CredentialsCryptoService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const rawKey =
      this.config.get<string>('credentials.encryptionKey') ??
      'dev-credentials-key-change-me-in-production';

    this.key = createHash('sha256').update(rawKey).digest();
  }

  encrypt(value: unknown): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const plaintext = JSON.stringify(value);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  decrypt<T>(payload: string): T {
    const [ivPart, authTagPart, encryptedPart] = payload.split('.');
    if (!ivPart || !authTagPart || !encryptedPart) {
      throw new Error('Invalid encrypted credentials payload');
    }

    const iv = Buffer.from(ivPart, 'base64url');
    const authTag = Buffer.from(authTagPart, 'base64url');
    const encrypted = Buffer.from(encryptedPart, 'base64url');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8');

    return JSON.parse(decrypted) as T;
  }

  maskSecret(secret: string): string {
    if (secret.length <= 4) {
      return '••••';
    }

    return `••••${secret.slice(-4)}`;
  }
}
