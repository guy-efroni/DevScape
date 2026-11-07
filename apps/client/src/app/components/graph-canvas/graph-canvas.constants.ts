import type { LayoutDirection as LayoutDirectionType } from './types/layout-direction.type';
import type { ViewFilter as ViewFilterType } from './types/view-filter.type';

/** Node sets offered by the view switcher. */
export const ViewFilter: {
  readonly Architecture: ViewFilterType;
  readonly FilesOnly: ViewFilterType;
  readonly All: ViewFilterType;
} = {
  Architecture: 'architecture',
  FilesOnly: 'files-only',
  All: 'all',
};

/** Layout presets offered by the toolbar. */
export const LayoutDirection: {
  readonly DagreLeftToRight: LayoutDirectionType;
  readonly DagreTopToBottom: LayoutDirectionType;
  readonly Grid: LayoutDirectionType;
} = {
  DagreLeftToRight: 'dagre-lr',
  DagreTopToBottom: 'dagre-tb',
  Grid: 'grid',
};

/** Cytoscape layout plugin names. */
export const LayoutName = {
  Dagre: 'dagre',
  Grid: 'grid',
} as const;

/** Dagre rank directions. */
export const RankDirection: {
  readonly LeftToRight: RankDirection;
  readonly TopToBottom: RankDirection;
} = {
  LeftToRight: 'LR',
  TopToBottom: 'TB',
};

export type RankDirection = 'LR' | 'TB';

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

export const GRAPH_LAYOUT = {
  FitPadding: 50,
  NodeSeparation: 60,
  RankSeparation: 100,
  AnimationDurationMilliseconds: 500,
} as const;

export const GRAPH_STYLE = {
  NodeFontSize: '11px',
  NodeFontWeight: 600,
  NodeBorderWidth: 1.5,
  NodeHeight: 34,
  NodePadding: '12px',
  FileFontWeight: 700,
  ClassBorderWidth: 2,
  EdgeWidth: 2.5,
  EdgeArrowScale: 1.1,
  EdgeFontSize: '10px',
  EdgeFontWeight: 600,
  EdgeTextMarginY: -8,
  EdgeTextBackgroundOpacity: 0.95,
  EdgeTextBackgroundPadding: '2px',
  SelectedNodeBorderWidth: 3,
  SelectedNodeOpacity: 1,
  SelectedEdgeWidth: 3.5,
  SelectedEdgeOpacity: 1,
  DimmedOpacity: 0.12,
} as const;

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
