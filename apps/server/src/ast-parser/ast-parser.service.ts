import { Injectable, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ICodeNode, IGraphEdge, ICodeGraph, FileRole } from '@devscape/shared';

@Injectable()
export class AstParserService {
  /**
   * Parse all `.ts` files in the given directory (recursively) and
   * return an ICodeGraph of extracted nodes and edges.
   */
  parseDirectory(directoryPath: string): ICodeGraph {
    const resolvedPath = path.resolve(directoryPath);

    if (!fs.existsSync(resolvedPath)) {
      throw new BadRequestException(
        `Directory does not exist: ${resolvedPath}`,
      );
    }

    if (!fs.statSync(resolvedPath).isDirectory()) {
      throw new BadRequestException(`Path is not a directory: ${resolvedPath}`);
    }

    const tsFiles = this.collectTsFiles(resolvedPath);

    if (tsFiles.length === 0) {
      return { nodes: [], edges: [] };
    }

    const program = ts.createProgram(tsFiles, {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      allowJs: false,
      noEmit: true,
      skipLibCheck: true,
    });

    const sourceFiles = program.getSourceFiles().filter((sf) => {
      if (sf.isDeclarationFile) return false;
      const normalized = path.normalize(sf.fileName);
      return normalized.startsWith(resolvedPath);
    });

    // Map of all known relative file paths in this project
    const knownFiles = new Set(
      sourceFiles.map((sf) =>
        path.relative(resolvedPath, path.normalize(sf.fileName)).replace(/\\/g, '/'),
      ),
    );

    const nodes: ICodeNode[] = [];
    const edges: IGraphEdge[] = [];

    // Pass 1: Extract all file nodes and AST entities (classes, interfaces, functions, variables)
    for (const sourceFile of sourceFiles) {
      const relativeFilePath = path
        .relative(resolvedPath, path.normalize(sourceFile.fileName))
        .replace(/\\/g, '/');

      const fileRole = this.detectFileRole(sourceFile, relativeFilePath);

      // 1. Extract file-level node
      nodes.push({
        id: relativeFilePath,
        name: path.basename(relativeFilePath),
        type: 'file',
        filePath: relativeFilePath,
        fileRole,
      });

      // 2. Extract AST entity nodes
      this.extractNodes(sourceFile, relativeFilePath, nodes);
    }

    // Build symbol lookup map by name for cross-file and internal symbol resolution
    const symbolMapByName = new Map<string, ICodeNode>();
    for (const node of nodes) {
      if (node.type !== 'file') {
        symbolMapByName.set(node.name, node);
      }
    }

    // Pass 2: Extract and resolve relationship edges
    for (const sourceFile of sourceFiles) {
      const relativeFilePath = path
        .relative(resolvedPath, path.normalize(sourceFile.fileName))
        .replace(/\\/g, '/');

      this.extractEdges(sourceFile, relativeFilePath, edges, knownFiles, symbolMapByName);
    }

    return { nodes, edges };
  }

  parse(directoryPath: string): ICodeGraph {
    return this.parseDirectory(directoryPath);
  }

  // ──────────────────────────────────────────────
  //  File role detection
  // ──────────────────────────────────────────────

  private detectFileRole(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
  ): FileRole {
    const baseName = path.basename(relativeFilePath).toLowerCase();

    // Check by file naming conventions
    if (baseName.endsWith('.controller.ts')) return 'controller';
    if (baseName.endsWith('.service.ts')) return 'service';
    if (baseName.endsWith('.component.ts')) return 'component';
    if (baseName.endsWith('.module.ts')) return 'module';
    if (baseName.endsWith('.dto.ts')) return 'dto';
    if (baseName.endsWith('.interface.ts')) return 'interface';
    if (baseName === 'index.ts') return 'barrel';
    if (baseName.endsWith('.config.ts') || baseName === 'main.ts') return 'config';

    // Check by AST decorators
    let detectedFromAst: FileRole | null = null;

    const visit = (node: ts.Node) => {
      if (detectedFromAst) return;

      if (ts.isClassDeclaration(node) && node.modifiers) {
        for (const modifier of node.modifiers) {
          if (ts.isDecorator(modifier)) {
            const expr = modifier.expression;
            const decoratorName = ts.isCallExpression(expr)
              ? expr.expression.getText(sourceFile)
              : expr.getText(sourceFile);

            if (decoratorName === 'Controller') detectedFromAst = 'controller';
            else if (decoratorName === 'Injectable') detectedFromAst = 'service';
            else if (decoratorName === 'Component') detectedFromAst = 'component';
            else if (decoratorName === 'Module') detectedFromAst = 'module';
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);

    return detectedFromAst ?? 'generic';
  }

  // ──────────────────────────────────────────────
  //  File collection
  // ──────────────────────────────────────────────

  private collectTsFiles(dir: string): string[] {
    const results: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === 'node_modules' ||
          entry.name === 'dist' ||
          entry.name.startsWith('.')
        ) {
          continue;
        }
        results.push(...this.collectTsFiles(fullPath));
      } else if (
        entry.name.endsWith('.ts') &&
        !entry.name.endsWith('.d.ts') &&
        !entry.name.endsWith('.spec.ts')
      ) {
        results.push(fullPath);
      }
    }

    return results;
  }

  // ──────────────────────────────────────────────
  //  Node extraction
  // ──────────────────────────────────────────────

  private extractNodes(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    nodes: ICodeNode[],
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        nodes.push(
          this.createNode(node.name.text, 'class', relativeFilePath),
        );
      } else if (ts.isFunctionDeclaration(node) && node.name) {
        nodes.push(
          this.createNode(node.name.text, 'function', relativeFilePath),
        );
      } else if (ts.isInterfaceDeclaration(node) && node.name) {
        nodes.push(
          this.createNode(node.name.text, 'interface', relativeFilePath),
        );
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            nodes.push(
              this.createNode(decl.name.text, 'variable', relativeFilePath),
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  private createNode(
    name: string,
    type: ICodeNode['type'],
    filePath: string,
  ): ICodeNode {
    return {
      id: `${filePath}::${name}`,
      name,
      type,
      filePath,
      parent: filePath,
    };
  }

  // ──────────────────────────────────────────────
  //  Edge extraction with Path & Symbol Resolution
  // ──────────────────────────────────────────────

  private extractEdges(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    knownFiles: Set<string>,
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    this.extractImports(sourceFile, relativeFilePath, edges, knownFiles);
    this.extractExtensions(sourceFile, relativeFilePath, edges, symbolMapByName);
    this.extractCalls(sourceFile, relativeFilePath, edges, symbolMapByName);
  }

  /**
   * Resolves relative import specifiers (e.g. `./app.service.js`) to the actual
   * target file node ID (e.g. `app.service.ts`).
   */
  private resolveImportTarget(
    relativeFilePath: string,
    importSpecifier: string,
    knownFiles: Set<string>,
  ): string {
    if (!importSpecifier.startsWith('.')) {
      return importSpecifier; // External module like '@nestjs/common'
    }

    const dir = path.dirname(relativeFilePath);
    let resolved = path.normalize(path.join(dir, importSpecifier)).replace(/\\/g, '/');
    resolved = resolved.replace(/\.(js|mjs|ts)$/, '');

    if (knownFiles.has(resolved + '.ts')) return resolved + '.ts';
    if (knownFiles.has(resolved + '/index.ts')) return resolved + '/index.ts';
    if (knownFiles.has(resolved)) return resolved;

    return resolved + '.ts';
  }

  /** Extract import declarations → "imports" edges */
  private extractImports(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    knownFiles: Set<string>,
  ): void {
    for (const stmt of sourceFile.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;

      const moduleSpecifier = stmt.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpecifier)) continue;

      const rawSpecifier = moduleSpecifier.text;
      const target = this.resolveImportTarget(relativeFilePath, rawSpecifier, knownFiles);

      edges.push({
        source: relativeFilePath,
        target,
        relation: 'imports',
      });
    }
  }

  /** Extract `extends` / `implements` clauses → "extends" edges */
  private extractExtensions(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    const visit = (node: ts.Node) => {
      if ((ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) {
        const entityName = node.name.text;
        const sourceId = `${relativeFilePath}::${entityName}`;

        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            for (const type of clause.types) {
              const baseTypeName = type.expression.getText(sourceFile);
              // Resolve target: if symbol exists in our graph, link to its exact node ID
              const matchingSymbol = symbolMapByName.get(baseTypeName);
              const target = matchingSymbol ? matchingSymbol.id : baseTypeName;

              edges.push({
                source: sourceId,
                target,
                relation: 'extends',
              });
            }
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }

  /** Extract function call expressions → "calls" edges */
  private extractCalls(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
    symbolMapByName: Map<string, ICodeNode>,
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        if (ts.isIdentifier(callee)) {
          const calleeName = callee.text;
          const matchingSymbol = symbolMapByName.get(calleeName);
          const target = matchingSymbol ? matchingSymbol.id : calleeName;

          edges.push({
            source: relativeFilePath,
            target,
            relation: 'calls',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }
}
