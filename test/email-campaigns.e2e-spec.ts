import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('EmailCampaigns (e2e)', () => {
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

  it('GET /email-campaigns requires authentication', () => {
    return request(app.getHttpServer()).get('/email-campaigns').expect(401);
  });

  it('POST /email-campaigns requires authentication', () => {
    return request(app.getHttpServer())
      .post('/email-campaigns')
      .send({
        name: 'Test Campaign',
        steps: [
          {
            stepOrder: 1,
            subject: 'Hello',
            body: 'Hi there',
            delayDays: 0,
          },
        ],
      })
      .expect(401);
  });

  it('GET /email-campaigns/:id requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-campaigns/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('PATCH /email-campaigns/:id requires authentication', () => {
    return request(app.getHttpServer())
      .patch('/email-campaigns/00000000-0000-0000-0000-000000000001')
      .send({ name: 'Updated' })
      .expect(401);
  });

  it('POST /email-campaigns/:id/schedule requires authentication', () => {
    return request(app.getHttpServer())
      .post('/email-campaigns/00000000-0000-0000-0000-000000000001/schedule')
      .send({
        launchAt: '2026-08-14',
        dailyBatchSize: 50,
        sendingWindowStartMinutes: 540,
        sendingWindowEndMinutes: 1020,
        timezone: 'UTC',
      })
      .expect(401);
  });

  it('GET /email-campaigns/:id/progress requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-campaigns/00000000-0000-0000-0000-000000000001/progress')
      .expect(401);
  });

  it('GET /email-campaigns/:id/recipients requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-campaigns/00000000-0000-0000-0000-000000000001/recipients')
      .expect(401);
  });

  it('GET /email-campaigns/:id/events requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-campaigns/00000000-0000-0000-0000-000000000001/events')
      .expect(401);
  });

  it('GET /email-campaigns/:id/recipients/:recipientId/events requires authentication', () => {
    return request(app.getHttpServer())
      .get(
        '/email-campaigns/00000000-0000-0000-0000-000000000001/recipients/00000000-0000-0000-0000-000000000002/events',
      )
      .expect(401);
  });

  it('GET /email-campaigns/:id/recipients/:recipientId requires authentication', () => {
    return request(app.getHttpServer())
      .get(
        '/email-campaigns/00000000-0000-0000-0000-000000000001/recipients/00000000-0000-0000-0000-000000000002',
      )
      .expect(401);
  });

  it('GET /email-excluded requires authentication', () => {
    return request(app.getHttpServer()).get('/email-excluded').expect(401);
  });

  it('PATCH /email-campaigns/:id/recipients/:recipientId requires authentication', () => {
    return request(app.getHttpServer())
      .patch(
        '/email-campaigns/00000000-0000-0000-0000-000000000001/recipients/00000000-0000-0000-0000-000000000002',
      )
      .send({ contactDisposition: 'paused' })
      .expect(401);
  });

  it('GET /email-campaigns/tracking-status requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-campaigns/tracking-status')
      .expect(401);
  });

  it('GET /track/open/:token returns a tracking pixel without auth', () => {
    return request(app.getHttpServer())
      .get('/track/open/00000000-0000-0000-0000-000000000099')
      .expect(200)
      .expect('Content-Type', /image\/gif/)
      .expect('Cross-Origin-Resource-Policy', 'cross-origin');
  });

  it('GET /track/click/:token requires a redirect url', () => {
    return request(app.getHttpServer())
      .get('/track/click/00000000-0000-0000-0000-000000000099')
      .expect(404);
  });

  it('GET /track/click/:token rejects unknown tokens for legacy url clicks', () => {
    return request(app.getHttpServer())
      .get('/track/click/00000000-0000-0000-0000-000000000099')
      .query({ url: 'https://example.com' })
      .expect(404);
  });

  it('GET /track/click/:token rejects unknown tokens for signed link clicks', () => {
    return request(app.getHttpServer())
      .get('/track/click/00000000-0000-0000-0000-000000000099')
      .query({ l: '0', sig: 'invalid-signature' })
      .expect(404);
  });

  it('GET /track/unsubscribe/:token rejects unknown tokens', () => {
    return request(app.getHttpServer())
      .get('/track/unsubscribe/00000000-0000-0000-0000-000000000099')
      .expect(404);
  });
});
