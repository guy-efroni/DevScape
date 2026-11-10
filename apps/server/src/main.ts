import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ALLOWED_CORS_METHODS, CLIENT_ORIGIN, DEFAULT_PORT } from './app.constants.js';

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

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

  const port: number = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
