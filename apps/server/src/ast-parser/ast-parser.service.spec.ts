import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AstParserService } from './ast-parser.service.js';
import { BadRequestException } from '@nestjs/common';
import type { ICodeGraph, ICodeNode, IGraphEdge } from '@devscape/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('AstParserService', (): void => {
  let service: AstParserService;
  let tempDir: string;

  beforeEach((): void => {
    service = new AstParserService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-parser-test-'));
  });

  afterEach((): void => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw BadRequestException for non-existent path', (): void => {
    expect(() => service.parseDirectory('/path/that/does/not/exist')).toThrow(
      BadRequestException,
    );
  });

  it('should return empty nodes and edges for empty directory', (): void => {
    const result: ICodeGraph = service.parseDirectory(tempDir);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('should parse an empty TypeScript file without compiler errors', (): void => {
    fs.writeFileSync(path.join(tempDir, 'empty.ts'), '');

    const result: ICodeGraph = service.parseDirectory(tempDir);

    expect(result.nodes).toContainEqual(
      expect.objectContaining({
        id: 'empty.ts',
        type: 'file',
        filePath: 'empty.ts',
      }),
    );
    expect(result.edges).toEqual([]);
  });

  it('should parse circular imports without filesystem or compiler errors', (): void => {
    fs.writeFileSync(
      path.join(tempDir, 'first.ts'),
      "import { second } from './second.js';\nexport const first = second;",
    );
    fs.writeFileSync(
      path.join(tempDir, 'second.ts'),
      "import { first } from './first.js';\nexport const second = first;",
    );

    const result: ICodeGraph = service.parseDirectory(tempDir);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'first.ts', type: 'file' }),
        expect.objectContaining({ id: 'second.ts', type: 'file' }),
      ]),
    );
    expect(result.edges).toEqual(
      expect.arrayContaining([
        {
          source: 'first.ts',
          target: 'second.ts',
          relation: 'imports',
        },
        {
          source: 'second.ts',
          target: 'first.ts',
          relation: 'imports',
        },
      ]),
    );
  });

  it('should parse local TypeScript files into nodes and import edges', (): void => {
    fs.writeFileSync(
      path.join(tempDir, 'entry.ts'),
      "import { helper } from './helper.js';\nexport const result = helper();",
    );
    fs.writeFileSync(
      path.join(tempDir, 'helper.ts'),
      'export function helper(): string { return "ok"; }',
    );

    const result: ICodeGraph = service.parseDirectory(tempDir);

    expect(result.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'entry.ts',
          type: 'file',
          filePath: 'entry.ts',
        }),
        expect.objectContaining({
          id: 'entry.ts::result',
          type: 'variable',
          filePath: 'entry.ts',
        }),
        expect.objectContaining({
          id: 'helper.ts',
          type: 'file',
          filePath: 'helper.ts',
        }),
        expect.objectContaining({
          id: 'helper.ts::helper',
          type: 'function',
          filePath: 'helper.ts',
        }),
      ]),
    );
    expect(result.edges).toContainEqual({
      source: 'entry.ts',
      target: 'helper.ts',
      relation: 'imports',
    });
  });

  it('should extract nodes, imports, inheritance, and call edges', (): void => {
    const sampleTs: string = `
      import { Injectable } from '@nestjs/common';

      export interface IUserService {
        getUser(id: string): string;
      }

      export interface IAdminService extends IUserService {
      }

      export class BaseService {
      }

      export class UserService extends BaseService implements IAdminService {
        getUser(id: string): string {
          return id;
        }
      }

      export function helper(): void {
      }

      export const DEFAULT_TIMEOUT = 5000;

      helper();
    `;

    fs.writeFileSync(path.join(tempDir, 'user.service.ts'), sampleTs);

    const result: ICodeGraph = service.parseDirectory(tempDir);

    // Expect file node
    const fileNode = result.nodes.find((n: ICodeNode) => n.type === 'file');
    expect(fileNode).toBeDefined();
    expect(fileNode?.name).toBe('user.service.ts');
    expect(fileNode?.fileRole).toBe('service');

    // Expect class node
    const classNode = result.nodes.find((n: ICodeNode) => n.name === 'UserService');
    expect(classNode).toBeDefined();
    expect(classNode?.type).toBe('class');
    expect(classNode?.parent).toBe('user.service.ts');

    // Expect interface node
    const ifaceNode = result.nodes.find((n: ICodeNode) => n.name === 'IUserService');
    expect(ifaceNode).toBeDefined();
    expect(ifaceNode?.type).toBe('interface');

    // Expect function node
    const funcNode = result.nodes.find((n: ICodeNode) => n.name === 'helper');
    expect(funcNode).toBeDefined();
    expect(funcNode?.type).toBe('function');

    // Expect variable node
    const varNode = result.nodes.find((n: ICodeNode) => n.name === 'DEFAULT_TIMEOUT');
    expect(varNode).toBeDefined();
    expect(varNode?.type).toBe('variable');

    // Expect import edge
    const importEdge = result.edges.find((e: IGraphEdge) => e.relation === 'imports');
    expect(importEdge).toBeDefined();
    expect(importEdge?.target).toBe('@nestjs/common');

    const inheritanceEdges: IGraphEdge[] = result.edges.filter(
      (edge: IGraphEdge): boolean => edge.relation === 'extends',
    );
    expect(inheritanceEdges).toEqual(
      expect.arrayContaining([
        {
          source: 'user.service.ts::IAdminService',
          target: 'user.service.ts::IUserService',
          relation: 'extends',
        },
        {
          source: 'user.service.ts::UserService',
          target: 'user.service.ts::BaseService',
          relation: 'extends',
        },
        {
          source: 'user.service.ts::UserService',
          target: 'user.service.ts::IAdminService',
          relation: 'extends',
        },
      ]),
    );

    const callsEdge = result.edges.find((e: IGraphEdge) => e.relation === 'calls');
    expect(callsEdge).toBeDefined();
    expect(callsEdge?.target).toBe('user.service.ts::helper');
  });
});
