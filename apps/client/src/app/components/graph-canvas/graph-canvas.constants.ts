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
  Hovered: 'hovered',
} as const;

export const SELECTOR = {
  Node: 'node',
  Edge: 'edge',
  All: 'node, edge',
  SelectedOrHighlightedNode: `node:selected, node.${CSS_CLASS.Highlighted}, node.${CSS_CLASS.Hovered}`,
  SelectedEdge: `edge:selected, edge.${CSS_CLASS.Hovered}`,
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
  NodeFontWeight: 600,
  NodeBorderWidth: 1,
  NodeHeight: 24,
  NodePadding: '8px',
  FileFontWeight: 600,
  ClassBorderWidth: 1,
  EdgeWidth: 1,
  EdgeOpacity: 0.3,
  EdgeArrowScale: 0.7,
  ActiveEdgeWidth: 2,
  ActiveEdgeFontSize: '10px',
  SelectedNodeBorderWidth: 1,
  SelectedNodeOpacity: 1,
  SelectedEdgeWidth: 2,
  SelectedEdgeOpacity: 1,
  DimmedOpacity: 0.12,
} as const;

export const LegendTone = {
  Service: 'service',
  Controller: 'controller',
  Module: 'module',
  Component: 'component',
  Neutral: 'neutral',
} as const;

export type LegendTone = (typeof LegendTone)[keyof typeof LegendTone];

export const LEGEND_LABEL = {
  Services: 'Services',
  Controllers: 'Controllers',
  Modules: 'Modules',
  Components: 'Components',
  Nodes: 'Nodes',
  Edges: 'Edges',
} as const;

export const KEYBOARD_KEY = {
  Fit: '0',
} as const;

export const CY_EVENT = {
  Tap: 'tap',
  Zoom: 'zoom',
  MouseOver: 'mouseover',
  MouseOut: 'mouseout',
} as const;

export const GRAPH_DEFAULTS = {
  ZoomPercent: 100,
  PixelRatioMin: 2,
  EdgeIdPrefix: 'edge-',
} as const;

export const PATH_TEXT = {
  Separator: '/',
  WindowsSeparatorPattern: /\\/g,
  ExtensionDot: '.',
  EdgeKeySeparator: '->',
  EdgeKeyMetaSeparator: ':',
} as const;

export const CY_DATA = {
  Label: 'data(label)',
  Relation: 'data(relation)',
} as const;

export const CY_FONT = {
  Mono: '"JetBrains Mono", ui-monospace, monospace',
  WeightActiveLabel: 400,
} as const;

export const CY_EDGE = {
  Color: '#3f3f46',
  DimColor: '#18181b',
  ActiveColor: '#3b82f6',
  OpacityHidden: 0.08,
  TextOpacityDimmed: 0.2,
  ZNode: 10,
  ZEdge: 9,
  TransitionDurationMs: 80,
  NodeTransition: 'border-color, color, line-color, target-arrow-color, opacity, width',
  EdgeTransition: 'line-color, line-opacity, target-arrow-color, width, opacity',
  ArrowTriangle: 'triangle',
  CurveTaxi: 'taxi',
  TaxiDirection: 'auto',
  TaxiTurn: '16px',
  CapSquare: 'square',
  TextBgPadding: '2px',
  TextBgShape: 'rectangle',
  TextRotationNone: 'none',
} as const;

export const CY_NODE = {
  TextWhite: '#ffffff',
  Shape: 'round-rectangle',
  CornerRadius: '4px',
  BorderSolid: 'solid',
  BorderDashed: 'dashed',
  BorderDotted: 'dotted',
  TextMaxWidth: '220px',
  TextWrap: 'ellipsis',
  ValignCenter: 'center',
  HalignCenter: 'center',
  WidthLabel: 'label',
  Neighborhood: 'node',
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
