import {
  Controller,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { AstParserService } from './ast-parser.service.js';
import type { ParseRequestDto } from './dto/parse-request.dto.js';

@Controller('api')
export class AstParserController {
  constructor(private readonly astParserService: AstParserService) {}

  @Post('parse')
  parse(@Body() body: ParseRequestDto) {
    if (!body.directoryPath || typeof body.directoryPath !== 'string') {
      throw new BadRequestException('directoryPath is required and must be a non-empty string');
    }

    return this.astParserService.parse(body.directoryPath);
  }
}

