# DevScape

**DevScape** — A local-first, privacy-focused developer workspace built with Angular and NestJS that parses local codebases, extracts Abstract Syntax Trees (AST), and generates interactive architecture node graphs.

---

## Project Vision

DevScape allows developers to point at any local TypeScript project directory and instantly receive a visual code graph showing classes, functions, interfaces, variables, and the relationships between them (imports, inheritance, function calls). Everything runs locally — no code leaves your machine.

## Monorepo Structure

```
DevScape/
├── apps/
│   ├── client/          # Angular 22 frontend (port 4200)
│   └── server/          # NestJS 12 backend  (port 3000)
├── packages/
│   └── shared/          # Shared TypeScript interfaces (ESM)
├── package.json         # Root manifest
└── README.md
```

### `apps/client` — Angular Frontend
- Angular 22 standalone application
- Calls the backend `POST /api/parse` endpoint
- Interactive Cytoscape.js canvas with force-directed (`cose`), hierarchical (`breadthfirst`), and circle layouts
- Dual view toggle: Visual Graph Canvas and Structured Table View
- Entity inspector showing node details, file paths, and color-coded badges
- SCSS styling, Vitest for unit tests

### `apps/server` — NestJS Backend
- NestJS 12 ESM application
- `AstParserService` — walks a directory, parses `.ts` files with the TypeScript Compiler API, extracts `ICodeNode[]` and `IGraphEdge[]`
- `AstParserController` — exposes `POST /api/parse` accepting `{ directoryPath: string }`
- CORS enabled for `http://localhost:4200`

### `packages/shared` — Shared Interfaces
- Pure TypeScript interfaces consumed by both apps
- Exports raw `.ts` source (no build step required)

## Interface Architectural Conventions

| Convention | Example |
|---|---|
| **`I` prefix** for all interfaces | `ICodeNode`, `IGraphEdge`, `ICodeGraph` |
| **One interface per file** in a dedicated `/interfaces/` folder | `code-node.interface.ts` |
| **Kebab-case filenames** with `.interface.ts` suffix | `graph-edge.interface.ts` |
| **Re-exported** via barrel `index.ts` | `export * from './interfaces/...'` |

### Current Shared Interfaces

- **`ICodeNode`** — A single code entity (class, function, interface, variable, file)
- **`IGraphEdge`** — A directional relationship between entities (imports, extends, calls)
- **`ICodeGraph`** — The complete graph: `{ nodes: ICodeNode[], edges: IGraphEdge[] }`

## Prerequisites

- **Node.js** ≥ 22
- **npm** ≥ 11

## Getting Started

```bash
# Install dependencies for each workspace
cd apps/server  && npm install
cd apps/client  && npm install

# Start the NestJS backend (port 3000)
cd apps/server  && npm run start:dev

# Start the Angular frontend (port 4200)
cd apps/client  && npm start
```

## Available Scripts

| Script | Location | Description |
|---|---|---|
| `npm run start:dev` | `apps/server` | Start NestJS in watch mode |
| `npm start` | `apps/client` | Start Angular dev server |
| `npm run build` | `apps/server` | Build NestJS for production |
| `npm run build` | `apps/client` | Build Angular for production |
| `npm test` | `apps/server` | Run Vitest unit tests |
| `npm test` | `apps/client` | Run Vitest unit tests |

## API Reference

### `POST /api/parse`

Parse a local TypeScript project directory into a code graph.

**Request body:**
```json
{
  "directoryPath": "C:/dev/my-project/src"
}
```

**Response (200):**
```json
{
  "nodes": [
    { "id": "app.ts::AppService", "name": "AppService", "type": "class", "filePath": "app.ts" }
  ],
  "edges": [
    { "source": "app.ts", "target": "./service.js", "relation": "imports" }
  ]
}
```

## Current Status

- [x] Monorepo structure with `apps/client`, `apps/server`, `packages/shared`
- [x] Shared interfaces: `ICodeNode`, `IGraphEdge`, `ICodeGraph`
- [x] AST parser service using TypeScript Compiler API
- [x] `POST /api/parse` endpoint with CORS
- [x] Angular UI shell with path input and results table
- [x] Interactive node-graph visualization (Cytoscape.js with force-directed, tree, and circle layouts)
- [x] File-level node type support
- [x] Dual view mode: Interactive Graph Canvas & Structured Table View
- [ ] Caching / incremental parsing
- [ ] Authentication & workspace management

## License

ISC
