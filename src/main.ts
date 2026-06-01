import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { PayoutsService } from './payouts/payouts.service';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { AppLoggerService } from './logger/logger.service';
import {
  getBullMQWorkerConfig,
  validateWorkerConfig,
} from './config/bullmq.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const isProduction = process.env.NODE_ENV === 'production';

  // Validate BullMQ worker configuration on startup
  const configService = app.get(ConfigService);
  const workerConfig = getBullMQWorkerConfig(configService);
  try {
    validateWorkerConfig(workerConfig);
    logger.log(
      `BullMQ worker configuration validated: ` +
        `clip-generation=${workerConfig.clipGenerationConcurrency}, ` +
        `email-delivery=${workerConfig.emailDeliveryConcurrency}`,
    );
  } catch (error) {
    logger.error(`Invalid BullMQ worker configuration: ${error.message}`);
    process.exit(1);
  }

  // Swagger setup - only available in non-production environments
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ClipCash API')
    .setDescription('ClipCash backend API documentation')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'access-token',
    )
    .addTag('auth', 'Authentication and authorization')
    .addTag('users', 'User management')
    .addTag('videos', 'Video upload and management')
    .addTag('clips', 'Clip generation and management')
    .addTag('subscriptions', 'Subscription and payment management')
    .addTag('webhooks', 'Webhook endpoints for external services')
    .addTag('wallets', 'Blockchain wallet management')
    .addTag('payouts', 'Revenue payouts')
    .addTag('earnings', 'Earnings tracking')
    .addTag('nfts', 'NFT minting and royalty queries')
    .addTag('nft', 'NFT minting and royalty management')
    .addTag('payout', 'Payout requests and processing')
    .addTag('stellar', 'Stellar network interactions')
    .addTag('jobs', 'Background job management')
    .addTag('platforms', 'Social platform integrations')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Export OpenAPI spec to file for external use
  const openapiPath = path.join(process.cwd(), 'openapi.json');
  fs.writeFileSync(openapiPath, JSON.stringify(document, null, 2));
  logger.log(`OpenAPI spec exported to ${openapiPath}`);

  // Setup Swagger UI (only in non-production or if explicitly enabled)
  const enableSwaggerUI = !isProduction || process.env.ENABLE_SWAGGER_UI === 'true';
  if (enableSwaggerUI) {
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'ClipCash API Documentation',
    });
    logger.log(`Swagger UI available at /api/docs`);
  } else {
    logger.log('Swagger UI disabled in production. Set ENABLE_SWAGGER_UI=true to enable.');
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true, // required for cross-origin cookie support
  });

  // Parse cookies (required for httpOnly cookie-based JWT support)
  app.use(cookieParser());

  // Raw body parser for webhook signature verification (must be before JSON parser for specific routes)
  // This preserves the raw body for HMAC signature verification
  app.use('/webhooks/stellar', bodyParser.raw({ type: 'application/json' }));

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`],
          scriptSrc: [`'self'`],
          imgSrc: [`'self'`, 'data:', 'https:'],
          connectSrc: [`'self'`],
          fontSrc: [`'self'`],
          objectSrc: [`'none'`],
          mediaSrc: [`'self'`],
          frameSrc: [`'none'`],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      xssFilter: true,
      hidePoweredBy: true,
      frameguard: {
        action: 'deny',
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(app.get(MetricsInterceptor));
  // Enable Nest's shutdown hooks so providers can clean up on signals
  app.enableShutdownHooks();

  // Listen for OS signals and perform a graceful shutdown that waits for
  // in-flight work to finish (e.g. BullMQ processors should finish jobs).
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    const timeoutMs = Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS) || 30000;
    const forceExit = setTimeout(() => {
      logger.error(`Shutdown timed out after ${timeoutMs}ms — forcing exit.`);
      process.exit(1);
    }, timeoutMs);

    try {
      await app.close();
      logger.log('Application closed cleanly. Exiting.');
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error('Error during application shutdown', err as any);
      clearTimeout(forceExit);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  await app.listen(process.env.PORT ?? 3000);

  // Start periodic payout verification to confirm on-chain transactions
  try {
    const payoutsService = app.get(PayoutsService);
    const intervalMs = parseInt(process.env.PAYOUT_VERIFIER_INTERVAL_MS ?? '60000', 10);

    // Run once on startup
    void payoutsService.verifyPendingPayouts().catch((err) => logger.error(`Payout verifier initial run failed: ${err?.message ?? err}`));

    // Schedule periodic runs
    setInterval(() => {
      void payoutsService.verifyPendingPayouts().catch((err) => logger.error(`Payout verifier error: ${err?.message ?? err}`));
    }, intervalMs);

    logger.log(`Payout verifier started (interval=${intervalMs}ms)`);
  } catch (err) {
    logger.warn('Payout verifier not started: PayoutsService not available');
  }
}
bootstrap();
