import {
  Controller,
  Post,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { AstParserService } from './ast-parser.service.js';
import { API_ROUTE_PREFIX } from '../app.constants.js';
import { PARSE_ROUTE } from './ast-parser.constants.js';
import type { IParseRequestDto } from './dto/parse-request.dto.js';

@Controller(API_ROUTE_PREFIX)
export class AstParserController {
  constructor(private readonly astParserService: AstParserService) {}

  @Post(PARSE_ROUTE)
  parse(@Body() body: IParseRequestDto) {
    if (!body.directoryPath || typeof body.directoryPath !== 'string') {
      throw new BadRequestException('directoryPath is required and must be a non-empty string');
    }

    return this.astParserService.parseDirectory(body.directoryPath);
  }
}
