import { environment } from '../environments/environment';

/** Base URL of the DevScape API server. */
export const API_BASE_URL: string = environment.apiUrl;

/** Endpoint that parses a directory into a code graph. */
export const API_PARSE_PATH = '/api/parse';

/** Main result views available on the results screen. */
export const ViewMode = {
  Graph: 'graph',
  Table: 'table',
} as const;

export type ViewMode = (typeof ViewMode)[keyof typeof ViewMode];

/** Fallback shown when a failure carries no message. */
export const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

export const AppStatus = {
  Ok: 'ok',
  Busy: 'busy',
  Error: 'error',
} as const;

export type AppStatus = (typeof AppStatus)[keyof typeof AppStatus];

export const APP_UI = {
  wordmark: 'DevScape',
  noProject: 'No project',
  status: {
    disconnected: 'Disconnected',
    parsing: 'Parsing',
    connected: 'Connected',
  },
  errorTag: 'ERR',
  start: {
    sectionLabel: 'TARGET',
    copy: 'Enter a local TypeScript directory to generate the codebase graph.',
    inputPlaceholder: 'Search or paste a project path',
    parsingPrefix: 'Parsing ',
  },
  meta: {
    engineKey: 'ENGINE',
    engineValue: 'AST / TS',
    scopeKey: 'SCOPE',
    scopeValue: 'LOCAL',
    renderKey: 'RENDER',
    renderValue: 'CYTOSCAPE',
  },
} as const;
