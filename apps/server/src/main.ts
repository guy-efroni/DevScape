import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ALLOWED_CORS_METHODS, CLIENT_ORIGIN, DEFAULT_PORT } from './app.constants.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: CLIENT_ORIGIN,
    methods: ALLOWED_CORS_METHODS,
  });

  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}
await bootstrap();
