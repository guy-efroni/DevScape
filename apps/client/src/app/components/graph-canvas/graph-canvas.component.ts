import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  Signal,
  ViewChild,
  WritableSignal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgZone } from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape, { CollectionReturnValue, Core, ElementDefinition, EventObject } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  EdgeRelation,
  FileRole,
  LEADING_RELATIVE_SEGMENT_PATTERN,
  MODULE_EXTENSION_PATTERN,
  NodeType,
} from '@devscape/shared';
import type { ICodeGraph, ICodeNode } from '@devscape/shared';
import type { IEdgeElementData } from './interfaces/edge-element-data.interface';
import type { INodeElementData } from './interfaces/node-element-data.interface';
import type { ISelectedElement } from './interfaces/selected-element.interface';
import type { ISelectedRelation } from './interfaces/selected-relation.interface';
import { GraphColor } from './enums/graph-color.enum';
import { GraphElementGroup } from './enums/graph-element-group.enum';
import { RelationDirection } from './enums/relation-direction.enum';
import {
  CSS_CLASS,
  CY_DATA,
  CY_EDGE,
  CY_EVENT,
  CY_FONT,
  CY_NODE,
  EDGE_LABEL_SEPARATOR,
  EXTERNAL_NODE_TYPE,
  FILE_LABEL_PREFIX,
  GRAPH_DEFAULTS,
  GRAPH_LAYOUT,
  GRAPH_STYLE,
  KEYBOARD_KEY,
  LEGEND_LABEL,
  LayoutDirection,
  LayoutName,
  LegendTone,
  PATH_TEXT,
  RankDirection,
  RELATIONSHIP_ELEMENT_TYPE,
  SELECTOR,
  ViewFilter,
  nodeLabelContainsSelector,
  nodeRoleSelector,
  nodeTypeSelector,
} from './graph-canvas.constants';
import type { LayoutDirection as LayoutDirectionType } from './types/layout-direction.type';
import type { GraphLayoutOptions } from './types/graph-layout-options.type';
import type { ViewFilter as ViewFilterType } from './types/view-filter.type';
import { InspectorCardComponent } from '../inspector-card/inspector-card.component';

cytoscape.use(dagre);

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [FormsModule, InspectorCardComponent],
  templateUrl: './graph-canvas.component.html',
  styleUrl: './graph-canvas.component.scss',
  host: {
    '(window:keydown)': 'onWindowKeydown($event)',
  },
})
export class GraphCanvasComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) public graph!: ICodeGraph;
  @ViewChild('cyContainer', { static: true }) public cyContainer!: ElementRef<HTMLDivElement>;

  private readonly _zone = inject(NgZone);
  private _cytoscapeInstance: Core | null = null;

  public readonly viewFilter: WritableSignal<ViewFilterType> = signal<ViewFilterType>(
    ViewFilter.Architecture,
  );
  public readonly activeLayout: WritableSignal<LayoutDirectionType> = signal<LayoutDirectionType>(
    LayoutDirection.DagreLeftToRight,
  );
  public readonly showExternal: WritableSignal<boolean> = signal<boolean>(false);
  public readonly searchTerm: WritableSignal<string> = signal<string>('');
  public readonly zoomPercent: WritableSignal<number> = signal<number>(GRAPH_DEFAULTS.ZoomPercent);
  public readonly ViewFilter = ViewFilter;
  public readonly LayoutDirection = LayoutDirection;

  public readonly selectedElement: WritableSignal<ISelectedElement | null> =
    signal<ISelectedElement | null>(null);

  public readonly legendCounts: Signal<Array<{ label: string; count: number; tone: string }>> = computed((): Array<{ label: string; count: number; tone: string }> => {
    const graph: ICodeGraph = this.graph;
    if (!graph) return [] as Array<{ label: string; count: number; tone: string }>;
    let services: number = 0;
    let controllers: number = 0;
    let modules: number = 0;
    let components: number = 0;
    for (const node of graph.nodes) {
      switch (node.fileRole) {
        case FileRole.Service:
          services++;
          break;
        case FileRole.Controller:
          controllers++;
          break;
        case FileRole.Module:
          modules++;
          break;
        case FileRole.Component:
          components++;
          break;
        default:
          break;
      }
    }
    const items: Array<{ label: string; count: number; tone: string }> = [];
    if (services) items.push({ label: LEGEND_LABEL.Services, count: services, tone: LegendTone.Service });
    if (controllers) items.push({ label: LEGEND_LABEL.Controllers, count: controllers, tone: LegendTone.Controller });
    if (modules) items.push({ label: LEGEND_LABEL.Modules, count: modules, tone: LegendTone.Module });
    if (components) items.push({ label: LEGEND_LABEL.Components, count: components, tone: LegendTone.Component });
    if (!items.length) {
      items.push({ label: LEGEND_LABEL.Nodes, count: graph.nodes.length, tone: LegendTone.Neutral });
      items.push({ label: LEGEND_LABEL.Edges, count: graph.edges.length, tone: LegendTone.Neutral });
    }
    return items;
  });

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.graph) {
      this._renderGraph();
    }
  }

  public ngOnDestroy(): void {
    if (this._cytoscapeInstance) {
      this._cytoscapeInstance.destroy();
      this._cytoscapeInstance = null;
    }
  }

  public setViewFilter(filter: ViewFilterType): void {
    this.viewFilter.set(filter);
    this._renderGraph();
  }

  public setLayout(layout: LayoutDirectionType): void {
    this.activeLayout.set(layout);
    this._runLayout();
  }

  public toggleExternal(): void {
    this.showExternal.set(!this.showExternal());
    this._renderGraph();
  }

  public fitView(): void {
    this._cytoscapeInstance?.fit(undefined, GRAPH_LAYOUT.FitPadding);
    this._syncZoom();
  }

  public onWindowKeydown(event: KeyboardEvent): void {
    const meta: boolean = event.metaKey || event.ctrlKey;
    if (!meta) return;
    if (event.key === KEYBOARD_KEY.Fit) {
      event.preventDefault();
      this.fitView();
    }
  }

  public onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (!this._cytoscapeInstance) return;

    this._cytoscapeInstance.batch((): void => {
      if (!term.trim()) {
        this._cytoscapeInstance!.$(SELECTOR.All).removeClass(
          `${CSS_CLASS.Highlighted} ${CSS_CLASS.Dimmed}`,
        );
        return;
      }

      const normalizedSearchTerm: string = term.toLowerCase().trim();
      const matchedNodes: CollectionReturnValue = this._cytoscapeInstance!.$(
        nodeLabelContainsSelector(normalizedSearchTerm),
      );
      this._cytoscapeInstance!.$(SELECTOR.All)
        .addClass(CSS_CLASS.Dimmed)
        .removeClass(CSS_CLASS.Highlighted);
      matchedNodes.removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
      matchedNodes.connectedEdges().removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
    });
  }

  private _syncZoom(): void {
    if (!this._cytoscapeInstance) return;
    this.zoomPercent.set(Math.round(this._cytoscapeInstance.zoom() * GRAPH_DEFAULTS.ZoomPercent));
  }

  private _runLayout(): void {
    if (!this._cytoscapeInstance) return;

    this._cytoscapeInstance.layout(this._createLayoutOptions(this.activeLayout())).run();
  }

  private _createLayoutOptions(selectedLayout: LayoutDirectionType): GraphLayoutOptions {
    const sharedLayoutOptions: Pick<
      GraphLayoutOptions,
      'animate' | 'animationDuration' | 'padding'
    > = {
      animate: true,
      animationDuration: GRAPH_LAYOUT.AnimationDurationMilliseconds,
      padding: GRAPH_LAYOUT.FitPadding,
    };

    if (selectedLayout === LayoutDirection.DagreLeftToRight) {
      return {
        ...sharedLayoutOptions,
        name: LayoutName.Dagre,
        rankDir: RankDirection.LeftToRight,
        nodeSep: GRAPH_LAYOUT.NodeSeparation,
        rankSep: GRAPH_LAYOUT.RankSeparation,
      };
    }

    if (selectedLayout === LayoutDirection.DagreTopToBottom) {
      return {
        ...sharedLayoutOptions,
        name: LayoutName.Dagre,
        rankDir: RankDirection.TopToBottom,
        nodeSep: GRAPH_LAYOUT.NodeSeparation,
        rankSep: GRAPH_LAYOUT.RankSeparation,
      };
    }

    return {
      ...sharedLayoutOptions,
      name: LayoutName.Grid,
    };
  }

  private _applySelection(nodeId: string): void {
    if (!this._cytoscapeInstance) return;
    this._cytoscapeInstance.batch((): void => {
      const all: CollectionReturnValue = this._cytoscapeInstance!.$(SELECTOR.All);
      all.removeClass(`${CSS_CLASS.Highlighted} ${CSS_CLASS.Dimmed} ${CSS_CLASS.Hovered}`);
      const node: CollectionReturnValue = this._cytoscapeInstance!.$id(nodeId);
      all.addClass(CSS_CLASS.Dimmed);
      node.removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
      node.connectedEdges().removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
      node.neighborhood(CY_NODE.Neighborhood).removeClass(CSS_CLASS.Dimmed);
    });
  }

  private _clearSelectionClasses(): void {
    if (!this._cytoscapeInstance) return;
    this._cytoscapeInstance
      .$(SELECTOR.All)
      .removeClass(`${CSS_CLASS.Highlighted} ${CSS_CLASS.Dimmed} ${CSS_CLASS.Hovered}`);
  }

  private _renderGraph(): void {
    if (this._cytoscapeInstance) {
      this._cytoscapeInstance.destroy();
      this._cytoscapeInstance = null;
    }

    const elements: ElementDefinition[] = [];
    const allowedNodeIds: Set<string> = new Set<string>();

    const filter: ViewFilterType = this.viewFilter();
    const includeExternal: boolean = this.showExternal();

    const nodeById: Map<string, ICodeNode> = new Map<string, ICodeNode>();
    const nodeByName: Map<string, ICodeNode> = new Map<string, ICodeNode>();
    const nodeByNormalizedFilePath: Map<string, ICodeNode> = new Map<string, ICodeNode>();

    for (const node of this.graph.nodes) {
      nodeById.set(node.id, node);
      nodeByName.set(node.name, node);
      const normalizedFilePath: string = node.filePath
        .replace(MODULE_EXTENSION_PATTERN, '')
        .toLowerCase();
      nodeByNormalizedFilePath.set(normalizedFilePath, node);
    }

    const filteredNodes: ICodeNode[] = this.graph.nodes.filter((node: ICodeNode): boolean => {
      if (filter === ViewFilter.FilesOnly) {
        return node.type === NodeType.File;
      }
      if (filter === ViewFilter.Architecture) {
        return (
          node.type === NodeType.File ||
          node.type === NodeType.Class ||
          node.type === NodeType.Interface
        );
      }
      return true;
    });

    for (const node of filteredNodes) {
      allowedNodeIds.add(node.id);
      elements.push(this._createNodeElement(node));
    }

    const resolveToVisibleNodeId = (rawEndpoint: string): string | null => {
      if (allowedNodeIds.has(rawEndpoint)) return rawEndpoint;

      const node: ICodeNode | undefined = nodeById.get(rawEndpoint);
      if (node && node.parent && allowedNodeIds.has(node.parent)) {
        return node.parent;
      }

      const nodeWithMatchingName: ICodeNode | undefined = nodeByName.get(rawEndpoint);
      if (nodeWithMatchingName) {
        if (allowedNodeIds.has(nodeWithMatchingName.id)) return nodeWithMatchingName.id;
        if (nodeWithMatchingName.parent && allowedNodeIds.has(nodeWithMatchingName.parent))
          return nodeWithMatchingName.parent;
      }

      const normalizedEndpoint: string = rawEndpoint
        .replace(LEADING_RELATIVE_SEGMENT_PATTERN, '')
        .replace(MODULE_EXTENSION_PATTERN, '')
        .toLowerCase();
      const nodeWithMatchingPath: ICodeNode | undefined =
        nodeByNormalizedFilePath.get(normalizedEndpoint);
      if (nodeWithMatchingPath && allowedNodeIds.has(nodeWithMatchingPath.id)) {
        return nodeWithMatchingPath.id;
      }

      return null;
    };

    let edgeIndex: number = 0;
    const addedEdgeKeys: Set<string> = new Set<string>();

    for (const edge of this.graph.edges) {
      const resolvedSource: string | null = resolveToVisibleNodeId(edge.source);
      const resolvedTarget: string | null = resolveToVisibleNodeId(edge.target);

      if (resolvedSource && resolvedTarget) {
        if (resolvedSource === resolvedTarget) continue;

        const edgeKey: string = `${resolvedSource}${PATH_TEXT.EdgeKeySeparator}${resolvedTarget}${PATH_TEXT.EdgeKeyMetaSeparator}${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push(
            this._createEdgeElement(
              `${GRAPH_DEFAULTS.EdgeIdPrefix}${edgeIndex++}`,
              resolvedSource,
              resolvedTarget,
              edge.relation,
            ),
          );
        }
        continue;
      }

      if (includeExternal && resolvedSource && !resolvedTarget) {
        if (!allowedNodeIds.has(edge.target)) {
          allowedNodeIds.add(edge.target);
          elements.push(this._createExternalNodeElement(edge.target));
        }

        const edgeKey: string = `${resolvedSource}${PATH_TEXT.EdgeKeySeparator}${edge.target}${PATH_TEXT.EdgeKeyMetaSeparator}${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push(
            this._createEdgeElement(
              `${GRAPH_DEFAULTS.EdgeIdPrefix}${edgeIndex++}`,
              resolvedSource,
              edge.target,
              edge.relation,
            ),
          );
        }
      }
    }

    const dpr: number = Math.max(window.devicePixelRatio || 1, GRAPH_DEFAULTS.PixelRatioMin);
    this._cytoscapeInstance = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      pixelRatio: dpr,
      style: [
        {
          selector: SELECTOR.Node,
          style: {
            label: CY_DATA.Label,
            'font-family': CY_FONT.Mono,
            'font-size': GRAPH_STYLE.NodeFontSize,
            'font-weight': GRAPH_STYLE.NodeFontWeight,
            color: CY_NODE.Text,
            'text-valign': CY_NODE.ValignCenter,
            'text-halign': CY_NODE.HalignCenter,
            'text-max-width': CY_NODE.TextMaxWidth,
            'text-wrap': CY_NODE.TextWrap,
            'background-color': GraphColor.FileBackground,
            'background-opacity': 1,
            'border-width': GRAPH_STYLE.NodeBorderWidth,
            'border-color': GraphColor.NeutralBorder,
            'border-style': CY_NODE.BorderSolid,
            shape: CY_NODE.Shape,
            'corner-radius': CY_NODE.CornerRadius,
            width: CY_NODE.WidthLabel,
            height: GRAPH_STYLE.NodeHeight,
            padding: GRAPH_STYLE.NodePadding,
            'overlay-opacity': 0,
            'transition-property': CY_EDGE.NodeTransition,
            'transition-duration': CY_EDGE.TransitionDurationMs,
          },
        },
        { selector: nodeTypeSelector(NodeType.File), style: { 'background-color': GraphColor.FileBackground, 'border-color': GraphColor.FileBorder } },
        { selector: nodeRoleSelector(FileRole.Controller), style: { 'border-color': GraphColor.ControllerText, color: GraphColor.SelectionText } },
        { selector: nodeRoleSelector(FileRole.Service), style: { 'border-color': GraphColor.ServiceText, color: GraphColor.SelectionText } },
        { selector: nodeRoleSelector(FileRole.Component), style: { 'border-color': GraphColor.ComponentText, color: GraphColor.SelectionText } },
        { selector: nodeRoleSelector(FileRole.Module), style: { 'border-color': GraphColor.ModuleText } },
        { selector: nodeTypeSelector(NodeType.Class), style: { 'border-color': GraphColor.ClassText } },
        { selector: nodeTypeSelector(NodeType.Interface), style: { 'border-color': GraphColor.InterfaceText, 'border-style': CY_NODE.BorderDashed } },
        { selector: nodeTypeSelector(NodeType.Function), style: { 'border-color': GraphColor.FunctionText } },
        { selector: nodeTypeSelector(NodeType.Variable), style: { 'border-color': GraphColor.VariableText } },
        { selector: nodeTypeSelector(EXTERNAL_NODE_TYPE), style: { 'background-color': GraphColor.ExternalBackground, 'border-color': GraphColor.ExternalBorder, 'border-style': CY_NODE.BorderDotted, color: GraphColor.ExternalText } },
        {
          selector: SELECTOR.Edge,
          style: {
            width: GRAPH_STYLE.EdgeWidth,
            'line-color': CY_EDGE.Color,
            'line-opacity': GRAPH_STYLE.EdgeOpacity,
            'target-arrow-color': CY_EDGE.Color,
            'target-arrow-shape': CY_EDGE.ArrowTriangle,
            'arrow-scale': GRAPH_STYLE.EdgeArrowScale,
            label: '',
            'curve-style': CY_EDGE.CurveTaxi,
            'taxi-direction': CY_EDGE.TaxiDirection,
            'taxi-turn': CY_EDGE.TaxiTurn,
            'line-cap': CY_EDGE.CapSquare,
            'overlay-opacity': 0,
            'transition-property': CY_EDGE.EdgeTransition,
            'transition-duration': CY_EDGE.TransitionDurationMs,
          },
        },
        { selector: 'node:active', style: { 'overlay-opacity': 0 } },
        { selector: SELECTOR.SelectedOrHighlightedNode, style: { 'border-width': GRAPH_STYLE.SelectedNodeBorderWidth, 'border-color': GraphColor.Selection, 'background-color': 'rgba(87, 148, 232, 0.12)', 'background-opacity': 1, 'z-index': CY_EDGE.ZNode, opacity: GRAPH_STYLE.SelectedNodeOpacity, color: GraphColor.SelectionText } },
        {
          selector: SELECTOR.SelectedEdge,
          style: {
            width: GRAPH_STYLE.ActiveEdgeWidth,
            'line-color': CY_EDGE.ActiveColor,
            'line-opacity': 1,
            'target-arrow-color': CY_EDGE.ActiveColor,
            label: CY_DATA.Relation,
            'font-family': CY_FONT.Mono,
            'font-size': GRAPH_STYLE.ActiveEdgeFontSize,
            'font-weight': CY_FONT.WeightActiveLabel,
            color: CY_EDGE.ActiveColor,
            'text-rotation': CY_EDGE.TextRotationNone,
            'text-background-color': GraphColor.CanvasBackground,
            'text-background-opacity': 1,
            'text-background-padding': CY_EDGE.TextBgPadding,
            'text-background-shape': CY_EDGE.TextBgShape,
            'z-index': CY_EDGE.ZEdge,
            opacity: GRAPH_STYLE.SelectedEdgeOpacity,
          },
        },
        { selector: SELECTOR.Dimmed, style: { opacity: GRAPH_STYLE.DimmedOpacity, 'line-opacity': CY_EDGE.OpacityHidden, 'text-opacity': CY_EDGE.TextOpacityDimmed } },
      ],
    });

    this._runLayout();

    this._cytoscapeInstance.on(CY_EVENT.Zoom, () => this._zone.run(() => this._syncZoom()));
    this._syncZoom();

    this._cytoscapeInstance.on(CY_EVENT.Tap, SELECTOR.Node, (event: EventObject): void => {
      const nodeData = event.target.data() as INodeElementData;
      this._applySelection(nodeData.id);
      this._zone.run(() => {
        this.selectedElement.set({
          type: nodeData.type,
          label: nodeData.label,
          role: nodeData.fileRole,
          filePath: nodeData.filePath,
          ...this._deriveFileDisplay(nodeData.filePath, nodeData.label),
          relations: this._getNodeRelations(nodeData.id),
          metrics: this._computeMetrics(nodeData.id),
        });
      });
    });

    this._cytoscapeInstance.on(CY_EVENT.MouseOver, SELECTOR.Node, (event: EventObject): void => {
      event.target.addClass(CSS_CLASS.Hovered);
      event.target.connectedEdges().addClass(CSS_CLASS.Hovered);
    });
    this._cytoscapeInstance.on(CY_EVENT.MouseOut, SELECTOR.Node, (event: EventObject): void => {
      event.target.removeClass(CSS_CLASS.Hovered);
      event.target.connectedEdges().removeClass(CSS_CLASS.Hovered);
    });
    this._cytoscapeInstance.on(CY_EVENT.MouseOver, SELECTOR.Edge, (event: EventObject): void => {
      event.target.addClass(CSS_CLASS.Hovered);
    });
    this._cytoscapeInstance.on(CY_EVENT.MouseOut, SELECTOR.Edge, (event: EventObject): void => {
      event.target.removeClass(CSS_CLASS.Hovered);
    });

    this._cytoscapeInstance.on(CY_EVENT.Tap, SELECTOR.Edge, (event: EventObject): void => {
      const edgeData = event.target.data() as IEdgeElementData;
      this._cytoscapeInstance!.batch((): void => {
        const all: CollectionReturnValue = this._cytoscapeInstance!.$(SELECTOR.All);
        all.removeClass(`${CSS_CLASS.Highlighted} ${CSS_CLASS.Dimmed} ${CSS_CLASS.Hovered}`);
        all.addClass(CSS_CLASS.Dimmed);
        event.target.removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
        event.target.connectedNodes().removeClass(CSS_CLASS.Dimmed);
      });
      this._zone.run(() => {
        this.selectedElement.set({
          type: RELATIONSHIP_ELEMENT_TYPE,
          label: `${edgeData.source}${EDGE_LABEL_SEPARATOR}${edgeData.target}`,
          role: edgeData.relation,
          target: edgeData.target,
          relations: [
            {
              relation: edgeData.relation,
              direction: RelationDirection.Outgoing,
              connectedNode: edgeData.target,
              sourceId: edgeData.source,
              targetId: edgeData.target,
            },
          ],
          metrics: { loc: null, cyclomatic: null, inbound: 1, outbound: 1 },
        });
      });
    });

    this._cytoscapeInstance.on(CY_EVENT.Tap, (event: EventObject): void => {
      if (event.target === this._cytoscapeInstance) {
        this._clearSelectionClasses();
        this._zone.run(() => this.selectedElement.set(null));
      }
    });
  }

  private _deriveFileDisplay(
    filePath: string | undefined,
    label: string,
  ): { extension?: string; displayPath?: string } {
    const path: string = filePath ?? '';
    const normalized: string = path ? path.replace(PATH_TEXT.WindowsSeparatorPattern, PATH_TEXT.Separator) : '';
    const name: string = normalized ? normalized.split(PATH_TEXT.Separator).pop() ?? label : label;
    const dot: number = name.lastIndexOf(PATH_TEXT.ExtensionDot);
    const extension: string | undefined = dot > 0 ? name.slice(dot) : undefined;
    const displayPath: string | undefined = normalized || undefined;
    return { extension, displayPath };
  }

  private _computeMetrics(nodeId: string): ISelectedElement['metrics'] {
    let inbound: number = 0;
    let outbound: number = 0;
    for (const edge of this.graph.edges) {
      if (edge.source === nodeId) outbound++;
      if (edge.target === nodeId) inbound++;
    }
    const node: ICodeNode | undefined = this.graph.nodes.find(
      (graphNode: ICodeNode): boolean => graphNode.id === nodeId,
    );
    return {
      loc: node?.loc ?? null,
      cyclomatic: node?.cyclomaticComplexity ?? null,
      inbound,
      outbound,
    };
  }

  private _createNodeElement(node: ICodeNode): ElementDefinition {
    return {
      group: GraphElementGroup.Nodes,
      data: {
        id: node.id,
        label: node.type === NodeType.File ? `${FILE_LABEL_PREFIX}${node.name}` : node.name,
        type: node.type,
        fileRole: node.fileRole,
        filePath: node.filePath,
        loc: node.loc,
        cyclomaticComplexity: node.cyclomaticComplexity,
      },
    };
  }

  private _createExternalNodeElement(packageName: string): ElementDefinition {
    return {
      group: GraphElementGroup.Nodes,
      data: {
        id: packageName,
        label: packageName,
        type: EXTERNAL_NODE_TYPE,
      },
    };
  }

  private _createEdgeElement(
    edgeId: string,
    sourceNodeId: string,
    targetNodeId: string,
    relation: EdgeRelation,
  ): ElementDefinition {
    return {
      group: GraphElementGroup.Edges,
      data: {
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        relation,
      },
    };
  }

  private _getNodeRelations(nodeId: string): ISelectedRelation[] {
    return this.graph.edges.flatMap((edge): ISelectedRelation[] => {
      if (edge.source === nodeId) {
        return [
          {
            relation: edge.relation,
            direction: RelationDirection.Outgoing,
            connectedNode: edge.target,
            sourceId: edge.source,
            targetId: edge.target,
          },
        ];
      }

      if (edge.target === nodeId) {
        return [
          {
            relation: edge.relation,
            direction: RelationDirection.Incoming,
            connectedNode: edge.source,
            sourceId: edge.source,
            targetId: edge.target,
          },
        ];
      }

      return [];
    });
  }
}
