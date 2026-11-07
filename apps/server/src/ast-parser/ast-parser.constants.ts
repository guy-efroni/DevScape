import type { EdgeRelation, FileRole, NodeType } from '@devscape/shared';

/**
 * The values below mirror the `@devscape/shared` graph contract. They are
 * declared as literals because the server only imports the shared package at
 * type level, and `satisfies` keeps them in sync with the shared unions.
 */
export const NODE_TYPES = {
  File: 'file',
  Class: 'class',
  Function: 'function',
  Interface: 'interface',
  Variable: 'variable',
} as const satisfies Record<string, NodeType>;

export const EDGE_RELATIONS = {
  Imports: 'imports',
  Extends: 'extends',
  Calls: 'calls',
} as const satisfies Record<string, EdgeRelation>;

export const FILE_ROLES = {
  Controller: 'controller',
  Service: 'service',
  Component: 'component',
  Module: 'module',
  Dto: 'dto',
  Interface: 'interface',
  Config: 'config',
  Barrel: 'barrel',
  Generic: 'generic',
} as const satisfies Record<string, FileRole>;

/** Naming conventions that determine a file's role, checked in order. */
export const FILE_ROLE_BY_SUFFIX: ReadonlyArray<readonly [suffix: string, role: FileRole]> = [
  ['.controller.ts', FILE_ROLES.Controller],
  ['.service.ts', FILE_ROLES.Service],
  ['.component.ts', FILE_ROLES.Component],
  ['.module.ts', FILE_ROLES.Module],
  ['.dto.ts', FILE_ROLES.Dto],
  ['.interface.ts', FILE_ROLES.Interface],
  ['.config.ts', FILE_ROLES.Config],
];

/** Decorators that determine a file's role. */
export const FILE_ROLE_BY_DECORATOR: Readonly<Record<string, FileRole>> = {
  Controller: FILE_ROLES.Controller,
  Injectable: FILE_ROLES.Service,
  Component: FILE_ROLES.Component,
  Module: FILE_ROLES.Module,
};

/** Directory names that are never scanned for source files. */
export const IGNORED_DIRECTORIES: readonly string[] = ['node_modules', 'dist'];

/** Directories whose names start with this prefix (e.g. `.git`) are skipped. */
export const HIDDEN_DIRECTORY_PREFIX = '.';

export const TS_EXTENSION = '.ts';
export const TS_DECLARATION_EXTENSION = '.d.ts';
export const TS_TEST_EXTENSION = '.spec.ts';

/** Barrel file of a directory. */
export const INDEX_FILE_NAME = 'index.ts';

/** Application entry point, treated as configuration. */
export const ENTRY_FILE_NAME = 'main.ts';

/** Separator between a file path and a symbol name in a node ID. */
export const NODE_ID_SEPARATOR = '::';

/** Prefix of import specifiers that point inside the parsed project. */
export const RELATIVE_IMPORT_PREFIX = '.';

/** Normalized (POSIX) path separator used in node IDs. */
export const PATH_SEPARATOR = '/';

/** Matches Windows path separators, which are normalized to {@link PATH_SEPARATOR}. */
export const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g;

/** Matches a trailing JS/TS module extension so specifiers can be compared without it. */
export const MODULE_EXTENSION_PATTERN = /\.(js|mjs|ts)$/;

/** Route that parses a directory into a code graph. */
export const PARSE_ROUTE = 'parse';
