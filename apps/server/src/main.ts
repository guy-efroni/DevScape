import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ALLOWED_CORS_METHODS, CLIENT_ORIGIN, DEFAULT_PORT } from './app.constants.js';

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: CLIENT_ORIGIN,
    methods: ALLOWED_CORS_METHODS,
  });

  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}
await bootstrap();
