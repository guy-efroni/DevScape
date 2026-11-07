/** Node sets offered by the view switcher. */
export const ViewFilter = {
  Architecture: 'architecture',
  FilesOnly: 'files-only',
  All: 'all',
} as const;

export type ViewFilter = (typeof ViewFilter)[keyof typeof ViewFilter];

/** Layout presets offered by the toolbar. */
export const LayoutDirection = {
  DagreLeftToRight: 'dagre-lr',
  DagreTopToBottom: 'dagre-tb',
  Grid: 'grid',
} as const;

export type LayoutDirection = (typeof LayoutDirection)[keyof typeof LayoutDirection];

/** Cytoscape layout plugin names. */
export const LayoutName = {
  Dagre: 'dagre',
  Grid: 'grid',
} as const;

/** Dagre rank directions. */
export const RankDirection = {
  LeftToRight: 'LR',
  TopToBottom: 'TB',
} as const;

/** CSS classes applied to elements for search highlighting. */
export const CSS_CLASS = {
  Highlighted: 'highlighted',
  Dimmed: 'dimmed',
} as const;

/** Reusable Cytoscape selectors. */
export const SELECTOR = {
  Node: 'node',
  Edge: 'edge',
  All: 'node, edge',
  SelectedOrHighlightedNode: `node:selected, node.${CSS_CLASS.Highlighted}`,
  SelectedEdge: 'edge:selected',
  Dimmed: `node.${CSS_CLASS.Dimmed}, edge.${CSS_CLASS.Dimmed}`,
} as const;

/** Node type used for synthetic nodes that stand for external packages. */
export const EXTERNAL_NODE_TYPE = 'external';

/** Element type shown in the inspector when an edge is selected. */
export const RELATIONSHIP_ELEMENT_TYPE = 'relationship';

/** Prefix that marks a node label as a file. */
export const FILE_LABEL_PREFIX = '📄 ';

/** Separator between source and target in an edge inspector label. */
export const EDGE_LABEL_SEPARATOR = ' ➔ ';

export function nodeTypeSelector(type: string): string {
  return `${SELECTOR.Node}[type = "${type}"]`;
}

export function nodeRoleSelector(role: string): string {
  return `${SELECTOR.Node}[fileRole = "${role}"]`;
}

export function edgeRelationSelector(relation: string): string {
  return `${SELECTOR.Edge}[relation = "${relation}"]`;
}

export function nodeLabelContainsSelector(term: string): string {
  return `${SELECTOR.Node}[label *= "${term}"]`;
}
