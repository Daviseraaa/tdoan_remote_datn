import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const corsOrigins = configService.get<string[]>('cors.origins', ['http://localhost:3001']);
  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  const normalizedOrigins = corsOrigins.map((origin) => origin.trim()).filter(Boolean);

  if (nodeEnv === 'production' && normalizedOrigins.includes('*')) {
    throw new Error('CORS_ORIGINS cannot contain "*" in production');
  }

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  app.use(helmet());

  app.enableCors({
    origin: normalizedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('DATN - Remote PC Control API')
    .setDescription(
      'API for remote PC control and automation system. ' +
      'Supports command execution, task management, workflow automation, ' +
      'and real-time agent communication via WebSocket.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth', 'Authentication & Authorization')
    .addTag('Users', 'User management')
    .addTag('Agents', 'Agent registration & management')
    .addTag('Tasks', 'Task execution & management')
    .addTag('Automation / Workflows', 'Workflow automation')
    .addTag('Health', 'System health checks')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
