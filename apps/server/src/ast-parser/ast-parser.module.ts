import { Module } from '@nestjs/common';
import { AstParserController } from './ast-parser.controller.js';
import { AstParserService } from './ast-parser.service.js';

@Module({
  controllers: [AstParserController],
  providers: [AstParserService],
  exports: [AstParserService],
})
export class AstParserModule {}

