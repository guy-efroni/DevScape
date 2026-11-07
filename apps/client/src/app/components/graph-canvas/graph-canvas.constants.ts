import type { LayoutDirection as LayoutDirectionType } from './types/layout-direction.type';
import type { ViewFilter as ViewFilterType } from './types/view-filter.type';

type RankDirectionType = 'LR' | 'TB';

export const ViewFilter: {
  readonly Architecture: ViewFilterType;
  readonly FilesOnly: ViewFilterType;
  readonly All: ViewFilterType;
} = {
  Architecture: 'architecture',
  FilesOnly: 'files-only',
  All: 'all',
};

export const LayoutDirection: {
  readonly DagreLeftToRight: LayoutDirectionType;
  readonly DagreTopToBottom: LayoutDirectionType;
  readonly Grid: LayoutDirectionType;
} = {
  DagreLeftToRight: 'dagre-lr',
  DagreTopToBottom: 'dagre-tb',
  Grid: 'grid',
};

export const LayoutName = {
  Dagre: 'dagre',
  Grid: 'grid',
} as const;

export const RankDirection: {
  readonly LeftToRight: RankDirectionType;
  readonly TopToBottom: RankDirectionType;
} = {
  LeftToRight: 'LR',
  TopToBottom: 'TB',
};

export type RankDirection = RankDirectionType;

export const CSS_CLASS = {
  Highlighted: 'highlighted',
  Dimmed: 'dimmed',
} as const;

export const SELECTOR = {
  Node: 'node',
  Edge: 'edge',
  All: 'node, edge',
  SelectedOrHighlightedNode: `node:selected, node.${CSS_CLASS.Highlighted}`,
  SelectedEdge: 'edge:selected',
  Dimmed: `node.${CSS_CLASS.Dimmed}, edge.${CSS_CLASS.Dimmed}`,
} as const;

export const EXTERNAL_NODE_TYPE = 'external';
export const RELATIONSHIP_ELEMENT_TYPE = 'relationship';
export const FILE_LABEL_PREFIX = '';
export const EDGE_LABEL_SEPARATOR = ' → ';

export const GRAPH_LAYOUT = {
  FitPadding: 40,
  NodeSeparation: 56,
  RankSeparation: 88,
  AnimationDurationMilliseconds: 300,
} as const;

export const GRAPH_STYLE = {
  NodeFontSize: '11px',
  NodeFontWeight: 500,
  NodeBorderWidth: 1,
  NodeHeight: 28,
  NodePadding: '10px',
  FileFontWeight: 600,
  ClassBorderWidth: 1,
  EdgeWidth: 1,
  EdgeArrowScale: 0.9,
  EdgeFontSize: '9px',
  EdgeFontWeight: 500,
  EdgeTextMarginY: -6,
  EdgeTextBackgroundOpacity: 1,
  EdgeTextBackgroundPadding: '2px',
  SelectedNodeBorderWidth: 1,
  SelectedNodeOpacity: 1,
  SelectedEdgeWidth: 1.5,
  SelectedEdgeOpacity: 1,
  DimmedOpacity: 0.15,
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
