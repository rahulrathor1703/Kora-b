import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Mailboxes (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /mailboxes requires authentication', () => {
    return request(app.getHttpServer()).get('/mailboxes').expect(401);
  });

  it('POST /mailboxes requires authentication', () => {
    return request(app.getHttpServer())
      .post('/mailboxes')
      .send({
        displayName: 'Sales',
        email: 'sales@example.com',
        provider: 'gmail',
        fromName: 'Sales Team',
        dailySendLimit: 100,
        warmupEnabled: false,
        appPassword: 'app-password',
      })
      .expect(401);
  });

  it('DELETE /mailboxes/:id requires authentication', () => {
    return request(app.getHttpServer())
      .delete('/mailboxes/mailbox-1')
      .expect(401);
  });
});
