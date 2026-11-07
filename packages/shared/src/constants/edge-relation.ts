/** Relationships that can connect two graph nodes. */
export const EdgeRelation = {
  Imports: 'imports',
  Extends: 'extends',
  Calls: 'calls',
} as const;

export type EdgeRelation = (typeof EdgeRelation)[keyof typeof EdgeRelation];
