import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
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
  EDGE_LABEL_SEPARATOR,
  EXTERNAL_NODE_TYPE,
  FILE_LABEL_PREFIX,
  GRAPH_LAYOUT,
  GRAPH_STYLE,
  LayoutDirection,
  LayoutName,
  RankDirection,
  RELATIONSHIP_ELEMENT_TYPE,
  SELECTOR,
  ViewFilter,
  edgeRelationSelector,
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
  public readonly zoomPercent: WritableSignal<number> = signal<number>(100);
  public readonly ViewFilter = ViewFilter;
  public readonly LayoutDirection = LayoutDirection;

  public readonly selectedElement: WritableSignal<ISelectedElement | null> =
    signal<ISelectedElement | null>(null);

  public readonly legendCounts = computed(() => {
    const g = this.graph;
    if (!g) return [] as Array<{ label: string; count: number; tone: string }>;
    const byRole = new Map<string, number>();
    let services = 0;
    let controllers = 0;
    let modules = 0;
    let components = 0;
    for (const n of g.nodes) {
      const role = n.fileRole?.toLowerCase();
      if (role === 'service') services++;
      else if (role === 'controller') controllers++;
      else if (role === 'module') modules++;
      else if (role === 'component') components++;
      else if (role) byRole.set(role, (byRole.get(role) ?? 0) + 1);
    }
    const items: Array<{ label: string; count: number; tone: string }> = [];
    if (services) items.push({ label: 'Services', count: services, tone: 'service' });
    if (controllers) items.push({ label: 'Controllers', count: controllers, tone: 'controller' });
    if (modules) items.push({ label: 'Modules', count: modules, tone: 'module' });
    if (components) items.push({ label: 'Components', count: components, tone: 'component' });
    if (!items.length) {
      items.push({ label: 'Nodes', count: g.nodes.length, tone: 'neutral' });
      items.push({ label: 'Edges', count: g.edges.length, tone: 'neutral' });
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
    const meta = event.metaKey || event.ctrlKey;
    if (!meta) return;
    if (event.key === '0') {
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
    this.zoomPercent.set(Math.round(this._cytoscapeInstance.zoom() * 100));
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

    const resolveToVisibleNodeId: (rawEndpoint: string) => string | null = (
      rawEndpoint: string,
    ): string | null => {
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

        const edgeKey: string = `${resolvedSource}->${resolvedTarget}:${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push(
            this._createEdgeElement(
              `edge-${edgeIndex++}`,
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

        const edgeKey: string = `${resolvedSource}->${edge.target}:${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push(
            this._createEdgeElement(
              `edge-${edgeIndex++}`,
              resolvedSource,
              edge.target,
              edge.relation,
            ),
          );
        }
      }
    }

    this._cytoscapeInstance = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      style: [
        {
          selector: SELECTOR.Node,
          style: {
            label: 'data(label)',
            'font-family': '"JetBrains Mono", ui-monospace, monospace',
            'font-size': GRAPH_STYLE.NodeFontSize,
            'font-weight': GRAPH_STYLE.NodeFontWeight,
            color: GraphColor.CanvasText,
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': GraphColor.CanvasBackground,
            'border-width': GRAPH_STYLE.NodeBorderWidth,
            'border-color': GraphColor.NeutralBorder,
            shape: 'round-rectangle',
            'corner-radius': '4px',
            width: 'label',
            height: GRAPH_STYLE.NodeHeight,
            padding: GRAPH_STYLE.NodePadding,
          },
        },

        {
          selector: nodeTypeSelector(NodeType.File),
          style: {
            'background-color': GraphColor.FileBackground,
            'border-color': GraphColor.FileBorder,
            'font-weight': GRAPH_STYLE.FileFontWeight,
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Controller),
          style: {
            'background-color': GraphColor.ControllerBackground,
            'border-color': GraphColor.ControllerBorder,
            color: GraphColor.ControllerText,
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Service),
          style: {
            'background-color': GraphColor.ServiceBackground,
            'border-color': GraphColor.ServiceBorder,
            color: GraphColor.ServiceText,
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Component),
          style: {
            'background-color': GraphColor.ComponentBackground,
            'border-color': GraphColor.ComponentBorder,
            color: GraphColor.ComponentText,
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Module),
          style: {
            'background-color': GraphColor.ModuleBackground,
            'border-color': GraphColor.ModuleBorder,
            color: GraphColor.ModuleText,
          },
        },

        {
          selector: nodeTypeSelector(NodeType.Class),
          style: {
            'background-color': GraphColor.ClassBackground,
            'border-color': GraphColor.ClassBorder,
            color: GraphColor.ClassText,
            'border-width': GRAPH_STYLE.ClassBorderWidth,
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Interface),
          style: {
            'background-color': GraphColor.InterfaceBackground,
            'border-color': GraphColor.InterfaceBorder,
            color: GraphColor.InterfaceText,
            'border-style': 'dashed',
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Function),
          style: {
            'background-color': GraphColor.FunctionBackground,
            'border-color': GraphColor.FunctionBorder,
            color: GraphColor.FunctionText,
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Variable),
          style: {
            'background-color': GraphColor.VariableBackground,
            'border-color': GraphColor.VariableBorder,
            color: GraphColor.VariableText,
          },
        },
        {
          selector: nodeTypeSelector(EXTERNAL_NODE_TYPE),
          style: {
            'background-color': GraphColor.ExternalBackground,
            'border-color': GraphColor.ExternalBorder,
            color: GraphColor.ExternalText,
            'font-style': 'italic',
          },
        },

        {
          selector: SELECTOR.Edge,
          style: {
            width: GRAPH_STYLE.EdgeWidth,
            'line-color': GraphColor.Edge,
            'target-arrow-color': GraphColor.Edge,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': GRAPH_STYLE.EdgeArrowScale,
            label: 'data(relation)',
            'font-size': GRAPH_STYLE.EdgeFontSize,
            'font-weight': GRAPH_STYLE.EdgeFontWeight,
            'font-family': '"JetBrains Mono", ui-monospace, monospace',
            'text-rotation': 'autorotate',
            'text-margin-y': GRAPH_STYLE.EdgeTextMarginY,
            color: GraphColor.ImportText,
            'text-background-color': GraphColor.CanvasBackground,
            'text-background-opacity': GRAPH_STYLE.EdgeTextBackgroundOpacity,
            'text-background-padding': GRAPH_STYLE.EdgeTextBackgroundPadding,
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Imports),
          style: {
            'line-color': GraphColor.Import,
            'target-arrow-color': GraphColor.Import,
            color: GraphColor.ImportText,
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Extends),
          style: {
            'line-color': GraphColor.Extends,
            'target-arrow-color': GraphColor.Extends,
            'line-style': 'dashed',
            color: GraphColor.ExtendsText,
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Calls),
          style: {
            'line-color': GraphColor.Calls,
            'target-arrow-color': GraphColor.Calls,
            color: GraphColor.CallsText,
          },
        },

        {
          selector: SELECTOR.SelectedOrHighlightedNode,
          style: {
            'border-width': GRAPH_STYLE.SelectedNodeBorderWidth,
            'border-color': GraphColor.Selection,
            'background-opacity': 1,
            opacity: GRAPH_STYLE.SelectedNodeOpacity,
          },
        },
        {
          selector: SELECTOR.SelectedEdge,
          style: {
            width: GRAPH_STYLE.SelectedEdgeWidth,
            opacity: GRAPH_STYLE.SelectedEdgeOpacity,
          },
        },
        {
          selector: SELECTOR.Dimmed,
          style: {
            opacity: GRAPH_STYLE.DimmedOpacity,
          },
        },
      ],
    });

    this._runLayout();

    this._cytoscapeInstance.on('zoom', () => this._zone.run(() => this._syncZoom()));
    this._syncZoom();

    this._cytoscapeInstance.on('tap', SELECTOR.Node, (event: EventObject): void => {
      const nodeData: INodeElementData = event.target.data() as INodeElementData;
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

    this._cytoscapeInstance.on('tap', SELECTOR.Edge, (event: EventObject): void => {
      const edgeData: IEdgeElementData = event.target.data() as IEdgeElementData;
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
            },
          ],
          metrics: { loc: null, cyclomatic: null, inbound: 1, outbound: 1 },
        });
      });
    });

    this._cytoscapeInstance.on('tap', (event: EventObject): void => {
      if (event.target === this._cytoscapeInstance) {
        this._zone.run(() => this.selectedElement.set(null));
      }
    });
  }

  private _deriveFileDisplay(
    filePath: string | undefined,
    label: string,
  ): { extension?: string; displayPath?: string } {
    const path = filePath ?? '';
    const name = path ? path.replace(/\\/g, '/').split('/').pop() ?? label : label;
    const dot = name.lastIndexOf('.');
    const extension = dot > 0 ? name.slice(dot) : undefined;
    const displayPath = path ? path.replace(/\\/g, '/') : undefined;
    return { extension, displayPath };
  }

  private _computeMetrics(nodeId: string): ISelectedElement['metrics'] {
    let inbound = 0;
    let outbound = 0;
    for (const e of this.graph.edges) {
      if (e.source === nodeId) outbound++;
      if (e.target === nodeId) inbound++;
    }
    return { loc: null, cyclomatic: null, inbound, outbound };
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
          },
        ];
      }

      if (edge.target === nodeId) {
        return [
          {
            relation: edge.relation,
            direction: RelationDirection.Incoming,
            connectedNode: edge.source,
          },
        ];
      }

      return [];
    });
  }
}
