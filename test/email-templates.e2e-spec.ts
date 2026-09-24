import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Email Templates (e2e)', () => {
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

  it('GET /email-templates requires authentication', () => {
    return request(app.getHttpServer()).get('/email-templates').expect(401);
  });

  it('GET /email-templates/:id requires authentication', () => {
    return request(app.getHttpServer())
      .get('/email-templates/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });

  it('POST /email-templates requires authentication', () => {
    return request(app.getHttpServer())
      .post('/email-templates')
      .send({
        name: 'Intro outreach',
        type: 'single',
        steps: [
          {
            stepOrder: 1,
            subject: 'Hello',
            body: 'Hi there',
          },
        ],
      })
      .expect(401);
  });

  it('PATCH /email-templates/:id requires authentication', () => {
    return request(app.getHttpServer())
      .patch('/email-templates/00000000-0000-0000-0000-000000000001')
      .send({ name: 'Updated' })
      .expect(401);
  });

  it('DELETE /email-templates/:id requires authentication', () => {
    return request(app.getHttpServer())
      .delete('/email-templates/00000000-0000-0000-0000-000000000001')
      .expect(401);
  });
});
