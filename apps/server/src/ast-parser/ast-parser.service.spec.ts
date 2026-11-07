import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AstParserService } from './ast-parser.service.js';
import { BadRequestException } from '@nestjs/common';
import type { ICodeNode, IGraphEdge } from '@devscape/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('AstParserService', () => {
  let service: AstParserService;
  let tempDir: string;

  beforeEach(() => {
    service = new AstParserService();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ast-parser-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should throw BadRequestException for non-existent path', () => {
    expect(() => service.parseDirectory('/path/that/does/not/exist')).toThrow(
      BadRequestException,
    );
  });

  it('should return empty nodes and edges for empty directory', () => {
    const result = service.parseDirectory(tempDir);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('should parse local TypeScript files into nodes and import edges', () => {
    fs.writeFileSync(
      path.join(tempDir, 'entry.ts'),
      "import { helper } from './helper.js';\nexport const result = helper();",
    );
    fs.writeFileSync(
      path.join(tempDir, 'helper.ts'),
      'export function helper(): string { return "ok"; }',
    );

    const result = service.parseDirectory(tempDir);

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

  it('should extract nodes, imports, inheritance, and call edges', () => {
    const sampleTs = `
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

    const result = service.parseDirectory(tempDir);

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
