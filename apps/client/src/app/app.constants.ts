/** Base URL of the DevScape API server. */
export const API_ORIGIN = 'http://localhost:3000';

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
