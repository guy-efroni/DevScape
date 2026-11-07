/** Kinds of AST entities that can appear as a node in the graph. */
export const NodeType = {
  Class: 'class',
  Function: 'function',
  Interface: 'interface',
  Variable: 'variable',
  File: 'file',
} as const;

export type NodeType = (typeof NodeType)[keyof typeof NodeType];
