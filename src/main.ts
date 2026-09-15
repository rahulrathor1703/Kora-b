import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import {
  isLocalTrackingHostname,
  parseTrackingBaseUrl,
  verifyTrackingOpenEndpoint,
} from './email-campaigns/tracking-config.util';

function warnIfTrackingUrlMisconfigured(trackingBaseUrl: string): void {
  const logger = new Logger('TrackingConfig');
  const parsed = parseTrackingBaseUrl(trackingBaseUrl);

  if (!parsed) {
    logger.warn(
      `TRACKING_BASE_URL "${trackingBaseUrl}" is not a valid URL — open/click tracking in campaign emails will fail`,
    );
    return;
  }

  if (isLocalTrackingHostname(parsed.hostname)) {
    logger.warn(
      `TRACKING_BASE_URL points to ${parsed.hostname} — external mail servers cannot load tracking pixels. ` +
        'Expose port 3008 via ngrok or localtunnel and set TRACKING_BASE_URL to the public URL.',
    );
  }
}

async function warnIfTrackingOpenEndpointUnreachable(
  trackingBaseUrl: string,
): Promise<void> {
  const logger = new Logger('TrackingConfig');
  const parsed = parseTrackingBaseUrl(trackingBaseUrl);

  if (!parsed) {
    return;
  }

  if (isLocalTrackingHostname(parsed.hostname)) {
    const verified = await verifyTrackingOpenEndpoint(trackingBaseUrl);
    if (verified) {
      logger.log(
        `TRACKING_BASE_URL open endpoint verified at ${trackingBaseUrl}`,
      );
    } else {
      logger.warn(
        `TRACKING_BASE_URL open endpoint probe failed for ${trackingBaseUrl} — open/click tracking may fail`,
      );
    }
    return;
  }

  const verified = await verifyTrackingOpenEndpoint(trackingBaseUrl);
  if (verified) {
    logger.log(
      `TRACKING_BASE_URL open endpoint verified at ${trackingBaseUrl}`,
    );
    return;
  }

  logger.warn(
    `TRACKING_BASE_URL open endpoint probe failed for ${trackingBaseUrl} — external mail servers cannot load tracking pixels. ` +
      'Use your direct API host (https://api.example.com) or frontend proxy with /api (https://app.example.com/api).',
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const trackingBaseUrl = config.get<string>(
    'trackingBaseUrl',
    'http://localhost:3008',
  );
  warnIfTrackingUrlMisconfigured(trackingBaseUrl);

  app.use(
    helmet({
      // Email clients load tracking pixels cross-origin; same-origin blocks opens.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>('frontendUrl'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = config.get<number>('port') ?? 3008;
  await app.listen(port, '0.0.0.0');
  await warnIfTrackingOpenEndpointUnreachable(trackingBaseUrl);
}
void bootstrap();
