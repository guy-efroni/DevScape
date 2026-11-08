import { Injectable, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ICodeNode, IGraphEdge, ICodeGraph, FileRole } from '@devscape/shared';
import {
  EDGE_RELATIONS,
  ENTRY_FILE_NAME,
  FILE_ROLE_BY_DECORATOR,
  FILE_ROLE_BY_SUFFIX,
  FILE_ROLES,
  HIDDEN_DIRECTORY_PREFIX,
  IGNORED_DIRECTORIES,
  INDEX_FILE_NAME,
  MODULE_EXTENSION_PATTERN,
  NODE_ID_SEPARATOR,
  NODE_TYPES,
  PATH_SEPARATOR,
  RELATIVE_IMPORT_PREFIX,
  TS_DECLARATION_EXTENSION,
  TS_EXTENSION,
  TS_TEST_EXTENSION,
  WINDOWS_PATH_SEPARATOR_PATTERN,
} from './ast-parser.constants.js';

@Injectable()
export class AstParserService {
  /**
   * Parse all `.ts` files in the given directory (recursively) and
   * return an ICodeGraph of extracted nodes and edges.
   */
  parseDirectory(directoryPath: string): ICodeGraph {
    const resolvedPath: string = path.resolve(directoryPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new BadRequestException(
        `Directory does not exist: ${resolvedPath}`,
      );
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      throw new BadRequestException(`Path is not a directory: ${resolvedPath}`);
    }

    const tsFiles: string[] = this._collectTsFiles(resolvedPath);

    if (tsFiles.length === 0) {
      return { nodes: [], edges: [] };
    }

    const program: ts.Program = ts.createProgram(tsFiles, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      allowJs: false,
      noEmit: true,
      skipLibCheck: true,
    });

    const sourceFiles: readonly ts.SourceFile[] = program.getSourceFiles().filter((sourceFile: ts.SourceFile): boolean => {
      if (sourceFile.isDeclarationFile) return false;
      const normalized: string = path.normalize(sourceFile.fileName);
      return normalized.startsWith(resolvedPath);
    });

    // Map of all known relative file paths in this project
    const knownFiles = new Set<string>(
      sourceFiles.map((sourceFile: ts.SourceFile): string => this._toRelativePath(resolvedPath, sourceFile.fileName)),
    );

    const nodes: ICodeNode[] = [];
    const edges: IGraphEdge[] = [];

    // Pass 1: Extract all file nodes and AST entities (classes, interfaces, functions, variables)
    for (const sourceFile of sourceFiles) {
      const relativeFilePath: string = this._toRelativePath(resolvedPath, sourceFile.fileName);

      const fileRole: FileRole = this._detectFileRole(sourceFile, relativeFilePath);

      // 1. Extract file-level node
      nodes.push({
        id: relativeFilePath,
        name: path.basename(relativeFilePath),
        type: NODE_TYPES.File,
        filePath: relativeFilePath,
        fileRole,
      });

      // 2. Extract AST entity nodes
      this._extractNodes(sourceFile, relativeFilePath, nodes);
    }

    // Build symbol lookup map by name for cross-file and internal symbol resolution
    const symbolMapByName = new Map<string, ICodeNode>();
    for (const node of nodes) {
      if (node.type !== NODE_TYPES.File) {
        symbolMapByName.set(node.name, node);
      }
    }

    // Pass 2: Extract and resolve relationship edges
    for (const sourceFile of sourceFiles) {
      const relativeFilePath: string = this._toRelativePath(resolvedPath, sourceFile.fileName);

      this._extractEdges(sourceFile, relativeFilePath, edges, knownFiles, symbolMapByName);
    }

    return { nodes, edges };
  }

  parse(directoryPath: string): ICodeGraph {
    return this.parseDirectory(directoryPath);
  }

  // ──────────────────────────────────────────────
  //  File role detection
  // ──────────────────────────────────────────────

  private _detectFileRole(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
  ): FileRole {
    const baseName: string = path.basename(relativeFilePath).toLowerCase();

    // Check by file naming conventions
    const conventionRole: FileRole | undefined = FILE_ROLE_BY_SUFFIX.find(
      ([suffix]: readonly [string, FileRole]): boolean => baseName.endsWith(suffix),
    )?.[1];
    if (conventionRole) return conventionRole;

    if (baseName === INDEX_FILE_NAME) return FILE_ROLES.Barrel;
    if (baseName === ENTRY_FILE_NAME) return FILE_ROLES.Config;

    // Check by AST decorators
    let detectedFromAst: FileRole | null = null;

    const visit = (astNode: ts.Node): void => {
      if (detectedFromAst) return;

      if (ts.isClassDeclaration(astNode) && astNode.modifiers) {
        for (const modifier of astNode.modifiers) {
          if (ts.isDecorator(modifier)) {
            const expr: ts.Expression = modifier.expression;
            const decoratorName: string = ts.isCallExpression(expr)
              ? expr.expression.getText(sourceFile)
              : expr.getText(sourceFile);

            const decoratorRole: FileRole | undefined = FILE_ROLE_BY_DECORATOR[decoratorName];
            if (decoratorRole) detectedFromAst = decoratorRole;
          }
        }
      }

      ts.forEachChild(astNode, visit);
    };

    ts.forEachChild(sourceFile, visit);

    return detectedFromAst ?? FILE_ROLES.Generic;
  }

  // ──────────────────────────────────────────────
  //  File collection
  // ──────────────────────────────────────────────

  private _collectTsFiles(directoryPath: string): string[] {
    const results: string[] = [];
    const entries: fs.Dirent[] = fs.readdirSync(directoryPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath: string = path.join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        if (
          IGNORED_DIRECTORIES.includes(entry.name) ||
          entry.name.startsWith(HIDDEN_DIRECTORY_PREFIX)
        ) {
          continue;
        }
        results.push(...this._collectTsFiles(fullPath));
      } else if (
        entry.name.endsWith(TS_EXTENSION) &&
        !entry.name.endsWith(TS_DECLARATION_EXTENSION) &&
        !entry.name.endsWith(TS_TEST_EXTENSION)
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  // ──────────────────────────────────────────────
  //  Path helpers
  // ──────────────────────────────────────────────

  /** Normalize a path to POSIX separators so node IDs are stable across platforms. */
  private _toPosixPath(value: string): string {
    return value.replace(WINDOWS_PATH_SEPARATOR_PATTERN, PATH_SEPARATOR);
  }

  private _toRelativePath(rootPath: string, fileName: string): string {
    return this._toPosixPath(path.relative(rootPath, path.normalize(fileName)));
  }

  // ──────────────────────────────────────────────
  //  Node extraction
  // ──────────────────────────────────────────────

  private _extractNodes(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    nodes: ICodeNode[],
  ): void {
    const loc: number = this._countLoc(sourceFile);
    const fileNode: ICodeNode | undefined = nodes.find((codeNode: ICodeNode): boolean => codeNode.id === relativeFilePath);
    if (fileNode) {
      fileNode.loc = loc;
      fileNode.cyclomaticComplexity = this._computeCyclomaticComplexity(sourceFile);
    }

    const visit = (astNode: ts.Node): void => {
      if (ts.isClassDeclaration(astNode) && astNode.name) {
        nodes.push(this._createNode(astNode.name.text, NODE_TYPES.Class, relativeFilePath, astNode, sourceFile));
      } else if (ts.isFunctionDeclaration(astNode) && astNode.name) {
        nodes.push(this._createNode(astNode.name.text, NODE_TYPES.Function, relativeFilePath, astNode, sourceFile));
      } else if (ts.isInterfaceDeclaration(astNode) && astNode.name) {
        nodes.push(this._createNode(astNode.name.text, NODE_TYPES.Interface, relativeFilePath, astNode, sourceFile));
      } else if (ts.isVariableStatement(astNode)) {
        for (const variableDeclaration of astNode.declarationList.declarations) {
          if (ts.isIdentifier(variableDeclaration.name)) {
            const init: ts.Expression | undefined = variableDeclaration.initializer;
            const isFnLike: boolean = !!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
            nodes.push(
              this._createNode(
                variableDeclaration.name.text,
                NODE_TYPES.Variable,
                relativeFilePath,
                isFnLike ? init : variableDeclaration,
                sourceFile,
              ),
            );
          }
        }
      }

      ts.forEachChild(astNode, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  private _countLoc(sourceFile: ts.SourceFile): number {
    const text: string = sourceFile.getFullText();
    if (!text) return 0;
    return text.split(/\r?\n/).length;
  }

  private _countNodeLoc(astNode: ts.Node, sourceFile: ts.SourceFile): number {
    const text: string = astNode.getText(sourceFile);
    if (!text) return 0;
    return text.split(/\r?\n/).length;
  }

  private _computeCyclomaticComplexity(rootNode: ts.Node): number {
    let complexity: number = 1;
    const visit = (astNode: ts.Node): void => {
      if (
        ts.isIfStatement(astNode) ||
        ts.isConditionalExpression(astNode) ||
        ts.isForStatement(astNode) ||
        ts.isForInStatement(astNode) ||
        ts.isForOfStatement(astNode) ||
        ts.isWhileStatement(astNode) ||
        ts.isDoStatement(astNode) ||
        ts.isCaseClause(astNode) ||
        ts.isCatchClause(astNode)
      ) {
        complexity++;
      }
      if (ts.isBinaryExpression(astNode)) {
        const operatorKind: ts.SyntaxKind = astNode.operatorToken.kind;
        if (
          operatorKind === ts.SyntaxKind.AmpersandAmpersandToken ||
          operatorKind === ts.SyntaxKind.BarBarToken ||
          operatorKind === ts.SyntaxKind.QuestionQuestionToken
        ) {
          complexity++;
        }
      }
      ts.forEachChild(astNode, visit);
    };
    ts.forEachChild(rootNode, visit);
    return complexity;
  }

  private _createNode(
    name: string,
    type: ICodeNode['type'],
    filePath: string,
    astNode?: ts.Node,
    sourceFile?: ts.SourceFile,
  ): ICodeNode {
    const base: ICodeNode = {
      id: `${filePath}${NODE_ID_SEPARATOR}${name}`,
      name,
      type,
      filePath,
      parent: filePath,
    };
    if (astNode && sourceFile) {
      base.loc = this._countNodeLoc(astNode, sourceFile);
      if (
        type === NODE_TYPES.Function ||
        type === NODE_TYPES.Class ||
        (type === NODE_TYPES.Variable &&
          (ts.isArrowFunction(astNode) || ts.isFunctionExpression(astNode)))
      ) {
        base.cyclomaticComplexity = this._computeCyclomaticComplexity(astNode);
      }
    }
    return base;
  }

  // ──────────────────────────────────────────────
  //  Edge extraction with Path & Symbol Resolution
  // ──────────────────────────────────────────────

  private _extractEdges(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    knownFiles: Set<string>,
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    this._extractImports(sourceFile, relativeFilePath, edges, knownFiles);
    this._extractExtensions(sourceFile, relativeFilePath, edges, symbolMapByName);
    this._extractCalls(sourceFile, relativeFilePath, edges, symbolMapByName);
  }

  /**
   * Resolves relative import specifiers (e.g. `./app.service.js`) to the actual
   * target file node ID (e.g. `app.service.ts`).
   */
  private _resolveImportTarget(
    relativeFilePath: string,
    importSpecifier: string,
    knownFiles: Set<string>,
  ): string {
    if (!importSpecifier.startsWith(RELATIVE_IMPORT_PREFIX)) {
      return importSpecifier; // External module like '@nestjs/common'
    }

    const sourceDirectory: string = path.dirname(relativeFilePath);
    let resolved: string = this._toPosixPath(
      path.normalize(path.join(sourceDirectory, importSpecifier)),
    );
    resolved = resolved.replace(MODULE_EXTENSION_PATTERN, '');

    const tsFilePath: string = resolved + TS_EXTENSION;
    const barrelFilePath: string = resolved + PATH_SEPARATOR + INDEX_FILE_NAME;

    if (knownFiles.has(tsFilePath)) return tsFilePath;
    if (knownFiles.has(barrelFilePath)) return barrelFilePath;
    if (knownFiles.has(resolved)) return resolved;

    return tsFilePath;
  }

  /** Extract import declarations → "imports" edges */
  private _extractImports(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    knownFiles: Set<string>,
  ): void {
    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement)) continue;

      const moduleSpecifier: ts.Expression = statement.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpecifier)) continue;

      const rawSpecifier: string = moduleSpecifier.text;
      const target: string = this._resolveImportTarget(relativeFilePath, rawSpecifier, knownFiles);

      edges.push({
        source: relativeFilePath,
        target,
        relation: EDGE_RELATIONS.Imports,
      });
    }
  }

  /** Extract `extends` / `implements` clauses → "extends" edges */
  private _extractExtensions(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    const visit = (astNode: ts.Node): void => {
      if ((ts.isClassDeclaration(astNode) || ts.isInterfaceDeclaration(astNode)) && astNode.name) {
        const entityName: string = astNode.name.text;
        const sourceId: string = `${relativeFilePath}${NODE_ID_SEPARATOR}${entityName}`;

        if (astNode.heritageClauses) {
          for (const clause of astNode.heritageClauses) {
            for (const typeNode of clause.types) {
              const baseTypeName: string = typeNode.expression.getText(sourceFile);
              // Resolve target: if symbol exists in our graph, link to its exact node ID
              const matchingSymbol: ICodeNode | undefined = symbolMapByName.get(baseTypeName);
              const target: string = matchingSymbol ? matchingSymbol.id : baseTypeName;

              edges.push({
                source: sourceId,
                target,
                relation: EDGE_RELATIONS.Extends,
              });
            }
          }
        }
      }

      ts.forEachChild(astNode, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  /** Extract function call expressions → "calls" edges */
  private _extractCalls(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    const visit = (astNode: ts.Node): void => {
      if (ts.isCallExpression(astNode)) {
        const callee: ts.Expression = astNode.expression;

        if (ts.isIdentifier(callee)) {
          const calleeName: string = callee.text;
          const matchingSymbol: ICodeNode | undefined = symbolMapByName.get(calleeName);
          const target: string = matchingSymbol ? matchingSymbol.id : calleeName;

          edges.push({
            source: relativeFilePath,
            target,
            relation: EDGE_RELATIONS.Calls,
          });
        }
      }

      ts.forEachChild(astNode, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }
}
