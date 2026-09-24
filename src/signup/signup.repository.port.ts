import type { SignupSession } from './entities/signup-session.entity';

export const SIGNUP_REPOSITORY = Symbol('SIGNUP_REPOSITORY');

export interface SignupRepositoryPort {
  create(email: string, token: string, expiresAt: Date): Promise<SignupSession>;
  createOAuthSession(input: {
    email: string;
    token: string;
    expiresAt: Date;
    oauthProvider: 'google' | 'apple';
    oauthSubjectId: string;
  }): Promise<SignupSession>;
  findByToken(token: string): Promise<SignupSession | null>;
  save(session: SignupSession): Promise<SignupSession>;
  deleteById(id: string): Promise<void>;
}
