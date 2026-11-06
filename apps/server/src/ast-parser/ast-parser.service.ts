import { Injectable, BadRequestException } from '@nestjs/common';
import * as ts from 'typescript';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ICodeNode, IGraphEdge, ICodeGraph } from '@devscape/shared';

@Injectable()
export class AstParserService {
  /**
   * Parse all `.ts` files in the given directory (recursively) and
   * return an ICodeGraph of extracted nodes and edges.
   */
  parse(directoryPath: string): ICodeGraph {
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

    const nodes: ICodeNode[] = [];
    const edges: IGraphEdge[] = [];

    for (const sourceFile of program.getSourceFiles()) {
      // Skip declaration files and files outside the target directory
      if (sourceFile.isDeclarationFile) continue;
      const normalizedSourcePath = path.normalize(sourceFile.fileName);
      if (!normalizedSourcePath.startsWith(resolvedPath)) continue;

      const relativeFilePath = path
        .relative(resolvedPath, normalizedSourcePath)
        .replace(/\\/g, '/');

      this.extractNodes(sourceFile, relativeFilePath, nodes);
      this.extractEdges(sourceFile, relativeFilePath, edges);
    }

    return { nodes, edges };
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
        // Skip node_modules, dist, and hidden directories
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
    };
  }

  // ──────────────────────────────────────────────
  //  Edge extraction
  // ──────────────────────────────────────────────

  private extractEdges(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
  ): void {
    this.extractImports(sourceFile, relativeFilePath, edges);
    this.extractExtensions(sourceFile, relativeFilePath, edges);
    this.extractCalls(sourceFile, relativeFilePath, edges);
  }

  /** Extract import declarations → "imports" edges */
  private extractImports(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
  ): void {
    for (const stmt of sourceFile.statements) {
      if (!ts.isImportDeclaration(stmt)) continue;

      const moduleSpecifier = stmt.moduleSpecifier;
      if (!ts.isStringLiteral(moduleSpecifier)) continue;

      const importPath = moduleSpecifier.text;

      // Collect named bindings
      const namedBindings = stmt.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          edges.push({
            source: relativeFilePath,
            target: importPath,
            relation: 'imports',
          });
        }
      } else if (stmt.importClause?.name) {
        // Default import
        edges.push({
          source: relativeFilePath,
          target: importPath,
          relation: 'imports',
        });
      } else {
        // Side-effect import  e.g. import './polyfill'
        edges.push({
          source: relativeFilePath,
          target: importPath,
          relation: 'imports',
        });
      }
    }
  }

  /** Extract `extends` / `implements` clauses → "extends" edges */
  private extractExtensions(
    sourceFile: ts.SourceFile,
    relativeFilePath: string,
    edges: IGraphEdge[],
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const className = node.name.text;

        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            for (const type of clause.types) {
              const baseTypeName = type.expression.getText(sourceFile);
              edges.push({
                source: `${relativeFilePath}::${className}`,
                target: baseTypeName,
                relation: 'extends',
              });
            }
          }
        }
      }

      if (ts.isInterfaceDeclaration(node) && node.name) {
        const interfaceName = node.name.text;

        if (node.heritageClauses) {
          for (const clause of node.heritageClauses) {
            for (const type of clause.types) {
              const baseTypeName = type.expression.getText(sourceFile);
              edges.push({
                source: `${relativeFilePath}::${interfaceName}`,
                target: baseTypeName,
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
  ): void {
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;

        // Direct function call:  foo()
        if (ts.isIdentifier(callee)) {
          edges.push({
            source: relativeFilePath,
            target: callee.text,
            relation: 'calls',
          });
        }

        // Property access call:  obj.method()
        if (ts.isPropertyAccessExpression(callee)) {
          edges.push({
            source: relativeFilePath,
            target: callee.getText(sourceFile),
            relation: 'calls',
          });
        }
      }

      ts.forEachChild(node, visit);
    };

    ts.forEachChild(sourceFile, visit);
  }
}

