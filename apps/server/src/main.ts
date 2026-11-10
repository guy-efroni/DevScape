import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DEFAULT_PORT } from './app.constants.js';

async function bootstrap(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (like Postman or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      // Automatically allow localhost and any render.com subdomain
      if (
        origin.startsWith('http://localhost:') ||
        origin.endsWith('.onrender.com')
      ) {
        return callback(null, true);
      }

      // Reject anything else
      return callback(new Error('Blocked by CORS policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port: number = Number(process.env.PORT) || DEFAULT_PORT;
  await app.listen(port, '0.0.0.0');
}
bootstrap();