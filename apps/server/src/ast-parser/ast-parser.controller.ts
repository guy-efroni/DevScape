import { Body, Controller, Post } from '@nestjs/common';
import type { ICodeGraph } from '@devscape/shared';
import { AstParserService } from './ast-parser.service.js';
import { API_ROUTE_PREFIX } from '../app.constants.js';
import { PARSE_ROUTE } from './ast-parser.constants.js';
import { ParseRequestDto } from './dto/parse-request.dto.js';

@Controller(API_ROUTE_PREFIX)
export class AstParserController {
  constructor(private readonly astParserService: AstParserService) {}

  @Post(PARSE_ROUTE)
  parse(@Body() body: ParseRequestDto): ICodeGraph {
    return this.astParserService.parseDirectory(body.directoryPath);
  }
}
