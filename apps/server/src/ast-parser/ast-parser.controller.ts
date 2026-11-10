import { Body, Controller, Post } from '@nestjs/common';
import type { ICodeGraph } from '@devscape/shared';
import { AstParserService } from './ast-parser.service.js';
import { PARSE_ROUTE } from './ast-parser.constants.js';
import { ParseRequestDto } from './dto/parse-request.dto.js';

@Controller(PARSE_ROUTE)
export class AstParserController {
  constructor(private readonly _astParserService: AstParserService) {}

  @Post()
  parse(@Body() body: ParseRequestDto): ICodeGraph {
    return this._astParserService.parseDirectory(body.directoryPath);
  }
}
