import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AstParserService } from './ast-parser.service.js';
import type { ICodeNode, IGraphEdge } from '@devscape/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('AstParserService', () => {
  let service: AstParserService;
  let tempDirectory: string;

  beforeAll(() => {
    service = new AstParserService();

    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-parser-test-'));

    fs.writeFileSync(
      path.join(tempDirectory, 'app.service.ts'),
      `
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(tempDirectory, 'app.controller.ts'),
      `
import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(tempDirectory, 'app.module.ts'),
      `
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
`,
      'utf-8',
    );

    fs.writeFileSync(
      path.join(tempDirectory, 'utils.ts'),
      `
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

export interface GreetOptions {
  prefix: string;
  suffix: string;
}

export const DEFAULT_GREETING = 'Hello';
`,
      'utf-8',
    );

    fs.mkdirSync(path.join(tempDirectory, 'models'));
    fs.writeFileSync(
      path.join(tempDirectory, 'models', 'user.model.ts'),
      `
import type { GreetOptions } from '../utils';

export interface User {
  id: number;
  name: string;
}

export class UserService {
  createUser(name: string): User {
    return { id: 1, name };
  }
}
`,
      'utf-8',
    );
  });

  afterAll(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('should return an ICodeGraph with nodes and edges', () => {
    const result = service.parseDirectory(tempDirectory);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('nodes');
    expect(result).toHaveProperty('edges');
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
  });

  it('should extract class declarations as nodes', () => {
    const result = service.parseDirectory(tempDirectory);
    const classNames = result.nodes
      .filter((node: ICodeNode) => node.type === 'class')
      .map((node: ICodeNode) => node.name);

    expect(classNames).toContain('AppService');
    expect(classNames).toContain('AppController');
    expect(classNames).toContain('AppModule');
    expect(classNames).toContain('UserService');
  });

  it('should extract interface declarations as nodes', () => {
    const result = service.parseDirectory(tempDirectory);
    const interfaceNames = result.nodes
      .filter((node: ICodeNode) => node.type === 'interface')
      .map((node: ICodeNode) => node.name);

    expect(interfaceNames).toContain('GreetOptions');
    expect(interfaceNames).toContain('User');
  });

  it('should extract function declarations as nodes', () => {
    const result = service.parseDirectory(tempDirectory);
    const functionNames = result.nodes
      .filter((node: ICodeNode) => node.type === 'function')
      .map((node: ICodeNode) => node.name);

    expect(functionNames).toContain('greet');
  });

  it('should extract variable declarations as nodes', () => {
    const result = service.parseDirectory(tempDirectory);
    const variableNames = result.nodes
      .filter((node: ICodeNode) => node.type === 'variable')
      .map((node: ICodeNode) => node.name);

    expect(variableNames).toContain('DEFAULT_GREETING');
  });

  it('should extract import relationships as edges', () => {
    const result = service.parseDirectory(tempDirectory);
    const importEdges = result.edges.filter((edge: IGraphEdge) => edge.relation === 'imports');

    expect(importEdges.length).toBeGreaterThan(0);

    const controllerImports = importEdges.filter(
      (edge: IGraphEdge) => edge.source.includes('app.controller') && edge.target.includes('app.service'),
    );
    expect(controllerImports.length).toBeGreaterThan(0);
  });

  it('should include nodes from subdirectories', () => {
    const result = service.parseDirectory(tempDirectory);
    const subdirectoryNodes = result.nodes.filter((node: ICodeNode) => node.filePath.includes('models'));

    expect(subdirectoryNodes.length).toBeGreaterThan(0);

    const nodeNames = subdirectoryNodes.map((node: ICodeNode) => node.name);
    expect(nodeNames).toContain('User');
    expect(nodeNames).toContain('UserService');
  });

  it('should return empty graph for non-existent directory', () => {
    expect(() => service.parseDirectory('/tmp/this-does-not-exist-xyz')).toThrow();
  });
});