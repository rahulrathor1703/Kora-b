import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Email Config (e2e)', () => {
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

  it('GET /email-config/options requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-config/options')
      .expect(401);
  });

  it('GET /email-config/options/:id requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-config/options/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('POST /email-config/options requires authentication', () => {
    return request(app.getHttpServer())
      .post('/email-config/options')
      .send({
        category: 'brand',
        label: 'InsureOps',
        value: 'insureops',
      })
      .expect(401);
  });

  it('PATCH /email-config/options/:id requires authentication', () => {
    return request(app.getHttpServer())
      .patch('/email-config/options/00000000-0000-0000-0000-000000000001')
      .send({ label: 'Updated' })
      .expect(401);
  });

  it('DELETE /email-config/options/:id requires authentication', () => {
    return request(app.getHttpServer())
      .delete('/email-config/options/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });
});
