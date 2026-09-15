import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignupSession } from './entities/signup-session.entity';
import type { SignupRepositoryPort } from './signup.repository.port';

@Injectable()
export class SignupRepository implements SignupRepositoryPort {
  constructor(
    @InjectRepository(SignupSession)
    private readonly sessions: Repository<SignupSession>,
  ) {}

  create(
    email: string,
    token: string,
    expiresAt: Date,
  ): Promise<SignupSession> {
    const session = this.sessions.create({
      email: email.toLowerCase(),
      token,
      expiresAt,
    });

    return this.sessions.save(session);
  }

  createOAuthSession(input: {
    email: string;
    token: string;
    expiresAt: Date;
    oauthProvider: 'google' | 'apple';
    oauthSubjectId: string;
  }): Promise<SignupSession> {
    const session = this.sessions.create({
      email: input.email.toLowerCase(),
      token: input.token,
      expiresAt: input.expiresAt,
      oauthProvider: input.oauthProvider,
      oauthSubjectId: input.oauthSubjectId,
      emailVerifiedAt: new Date(),
    });

    return this.sessions.save(session);
  }

  findByToken(token: string): Promise<SignupSession | null> {
    return this.sessions.findOne({ where: { token } });
  }

  save(session: SignupSession): Promise<SignupSession> {
    return this.sessions.save(session);
  }

  async deleteById(id: string): Promise<void> {
    await this.sessions.delete({ id });
  }
}
