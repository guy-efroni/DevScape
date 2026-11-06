import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AstParserModule } from './ast-parser/ast-parser.module.js';

@Module({
  imports: [AstParserModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
