import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  WritableSignal,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape, {
  CollectionReturnValue,
  Core,
  ElementDefinition,
  EventObject,
} from 'cytoscape';
import dagre from 'cytoscape-dagre';
import {
  EdgeRelation,
  FileRole,
  LEADING_RELATIVE_SEGMENT_PATTERN,
  MODULE_EXTENSION_PATTERN,
  NodeType,
} from '@devscape/shared';
import type { ICodeGraph, ICodeNode } from '@devscape/shared';
import type { EdgeElementData } from './interfaces/edge-element-data.interface';
import type { NodeElementData } from './interfaces/node-element-data.interface';
import type { SelectedElement } from './interfaces/selected-element.interface';
import {
  CSS_CLASS,
  EDGE_LABEL_SEPARATOR,
  EXTERNAL_NODE_TYPE,
  FILE_LABEL_PREFIX,
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
import type { GraphLayoutOptions } from './types/graph-layout-options.type';

cytoscape.use(dagre);

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './graph-canvas.component.html',
  styleUrl: './graph-canvas.component.scss',
})
export class GraphCanvasComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) graph!: ICodeGraph;
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef<HTMLDivElement>;

  private cytoscapeInstance: Core | null = null;

  protected readonly viewFilter: WritableSignal<ViewFilter> = signal<ViewFilter>(ViewFilter.Architecture);
  protected readonly activeLayout: WritableSignal<LayoutDirection> = signal<LayoutDirection>(
    LayoutDirection.DagreLeftToRight,
  );
  protected readonly showExternal: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly searchTerm: WritableSignal<string> = signal<string>('');

  protected readonly ViewFilter = ViewFilter;
  protected readonly LayoutDirection = LayoutDirection;

  protected readonly selectedElement: WritableSignal<SelectedElement | null> = signal<SelectedElement | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.graph) {
      this.renderGraph();
    }
  }

  ngOnDestroy(): void {
    if (this.cytoscapeInstance) {
      this.cytoscapeInstance.destroy();
      this.cytoscapeInstance = null;
    }
  }

  setViewFilter(filter: ViewFilter): void {
    this.viewFilter.set(filter);
    this.renderGraph();
  }

  setLayout(layout: LayoutDirection): void {
    this.activeLayout.set(layout);
    this.runLayout();
  }

  toggleExternal(): void {
    this.showExternal.set(!this.showExternal());
    this.renderGraph();
  }

  fitView(): void {
    this.cytoscapeInstance?.fit(undefined, 50);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (!this.cytoscapeInstance) return;

    this.cytoscapeInstance.batch((): void => {
      if (!term.trim()) {
        this.cytoscapeInstance!.$(SELECTOR.All).removeClass(`${CSS_CLASS.Highlighted} ${CSS_CLASS.Dimmed}`);
        return;
      }

      const normalizedSearchTerm: string = term.toLowerCase().trim();
      const matchedNodes: CollectionReturnValue = this.cytoscapeInstance!.$(
        nodeLabelContainsSelector(normalizedSearchTerm),
      );
      this.cytoscapeInstance!.$(SELECTOR.All).addClass(CSS_CLASS.Dimmed).removeClass(CSS_CLASS.Highlighted);
      matchedNodes.removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
      matchedNodes.connectedEdges().removeClass(CSS_CLASS.Dimmed).addClass(CSS_CLASS.Highlighted);
    });
  }

  private runLayout(): void {
    if (!this.cytoscapeInstance) return;

    const selectedLayout: LayoutDirection = this.activeLayout();
    let layoutOptions: GraphLayoutOptions;

    if (selectedLayout === LayoutDirection.DagreLeftToRight) {
      layoutOptions = {
        name: LayoutName.Dagre,
        rankDir: RankDirection.LeftToRight,
        nodeSep: 60,
        rankSep: 100,
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    } else if (selectedLayout === LayoutDirection.DagreTopToBottom) {
      layoutOptions = {
        name: LayoutName.Dagre,
        rankDir: RankDirection.TopToBottom,
        nodeSep: 60,
        rankSep: 100,
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    } else {
      layoutOptions = {
        name: LayoutName.Grid,
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    }

    this.cytoscapeInstance.layout(layoutOptions).run();
  }

  private renderGraph(): void {
    if (this.cytoscapeInstance) {
      this.cytoscapeInstance.destroy();
      this.cytoscapeInstance = null;
    }

    const elements: ElementDefinition[] = [];
    const allowedNodeIds: Set<string> = new Set<string>();

    const filter: ViewFilter = this.viewFilter();
    const includeExternal: boolean = this.showExternal();

    // Build comprehensive lookup indexes from the entire raw graph
    const nodeById: Map<string, ICodeNode> = new Map<string, ICodeNode>();
    const nodeByName: Map<string, ICodeNode> = new Map<string, ICodeNode>();
    const nodeByNormalizedFilePath: Map<string, ICodeNode> = new Map<string, ICodeNode>();

    for (const node of this.graph.nodes) {
      nodeById.set(node.id, node);
      nodeByName.set(node.name, node);
      const normalizedFilePath: string = node.filePath.replace(MODULE_EXTENSION_PATTERN, '').toLowerCase();
      nodeByNormalizedFilePath.set(normalizedFilePath, node);
    }

    // 1. Filter Nodes based on selected view mode
    const filteredNodes: ICodeNode[] = this.graph.nodes.filter((node: ICodeNode): boolean => {
      if (filter === ViewFilter.FilesOnly) {
        return node.type === NodeType.File;
      }
      if (filter === ViewFilter.Architecture) {
        return node.type === NodeType.File || node.type === NodeType.Class || node.type === NodeType.Interface;
      }
      return true;
    });

    for (const node of filteredNodes) {
      allowedNodeIds.add(node.id);
      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.type === NodeType.File ? `${FILE_LABEL_PREFIX}${node.name}` : node.name,
          type: node.type,
          fileRole: node.fileRole,
          filePath: node.filePath,
        },
      });
    }

    // Helper to resolve an edge endpoint to a currently visible node ID
    const resolveToVisibleNodeId: (rawEndpoint: string) => string | null = (rawEndpoint: string): string | null => {
      // Direct match
      if (allowedNodeIds.has(rawEndpoint)) return rawEndpoint;

      // Match by exact node ID in full graph -> check if its parent file is visible
      const node: ICodeNode | undefined = nodeById.get(rawEndpoint);
      if (node && node.parent && allowedNodeIds.has(node.parent)) {
        return node.parent;
      }

      // Match by symbol name
      const nodeWithMatchingName: ICodeNode | undefined = nodeByName.get(rawEndpoint);
      if (nodeWithMatchingName) {
        if (allowedNodeIds.has(nodeWithMatchingName.id)) return nodeWithMatchingName.id;
        if (nodeWithMatchingName.parent && allowedNodeIds.has(nodeWithMatchingName.parent)) return nodeWithMatchingName.parent;
      }

      // Match by normalized file path (e.g. `./app.service.js` or `app.service`)
      const normalizedEndpoint: string = rawEndpoint
        .replace(LEADING_RELATIVE_SEGMENT_PATTERN, '')
        .replace(MODULE_EXTENSION_PATTERN, '')
        .toLowerCase();
      const nodeWithMatchingPath: ICodeNode | undefined = nodeByNormalizedFilePath.get(normalizedEndpoint);
      if (nodeWithMatchingPath && allowedNodeIds.has(nodeWithMatchingPath.id)) {
        return nodeWithMatchingPath.id;
      }

      return null;
    };

    // 2. Filter & Add Edges
    let edgeIndex: number = 0;
    const addedEdgeKeys: Set<string> = new Set<string>();

    for (const edge of this.graph.edges) {
      const resolvedSource: string | null = resolveToVisibleNodeId(edge.source);
      const resolvedTarget: string | null = resolveToVisibleNodeId(edge.target);

      // A. Both endpoints resolve to visible nodes in current view
      if (resolvedSource && resolvedTarget) {
        // Prevent self-loops unless desired
        if (resolvedSource === resolvedTarget) continue;

        const edgeKey: string = `${resolvedSource}->${resolvedTarget}:${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push({
            group: 'edges',
            data: {
              id: `edge-${edgeIndex++}`,
              source: resolvedSource,
              target: resolvedTarget,
              relation: edge.relation,
            },
          });
        }
        continue;
      }

      // B. External library target (e.g. '@nestjs/common') when external toggle is ON
      if (includeExternal && resolvedSource && !resolvedTarget) {
        if (!allowedNodeIds.has(edge.target)) {
          allowedNodeIds.add(edge.target);
          elements.push({
            group: 'nodes',
            data: {
              id: edge.target,
              label: edge.target,
              type: EXTERNAL_NODE_TYPE,
            },
          });
        }

        const edgeKey: string = `${resolvedSource}->${edge.target}:${edge.relation}`;
        if (!addedEdgeKeys.has(edgeKey)) {
          addedEdgeKeys.add(edgeKey);
          elements.push({
            group: 'edges',
            data: {
              id: `edge-${edgeIndex++}`,
              source: resolvedSource,
              target: edge.target,
              relation: edge.relation,
            },
          });
        }
      }
    }

    // 3. Initialize Cytoscape with visible relation arrows
    this.cytoscapeInstance = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      style: [
        {
          selector: SELECTOR.Node,
          style: {
            'label': 'data(label)',
            'font-family': 'Inter, system-ui, -apple-system, sans-serif',
            'font-size': '11px',
            'font-weight': 600,
            'color': '#0f172a',
            'text-valign': 'center',
            'text-halign': 'center',
            'background-color': '#ffffff',
            'border-width': 1.5,
            'border-color': '#94a3b8',
            'shape': 'round-rectangle',
            'corner-radius': '6px',
            'width': 'label',
            'height': 34,
            'padding': '12px',
          },
        },

        // Role-based borders & tints for files
        {
          selector: nodeTypeSelector(NodeType.File),
          style: {
            'background-color': '#f8fafc',
            'border-color': '#64748b',
            'font-weight': 700,
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Controller),
          style: {
            'background-color': '#faf5ff',
            'border-color': '#a855f7',
            'color': '#6b21a8',
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Service),
          style: {
            'background-color': '#ecfeff',
            'border-color': '#06b6d4',
            'color': '#0e7490',
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Component),
          style: {
            'background-color': '#eef2ff',
            'border-color': '#6366f1',
            'color': '#3730a3',
          },
        },
        {
          selector: nodeRoleSelector(FileRole.Module),
          style: {
            'background-color': '#f5f3ff',
            'border-color': '#8b5cf6',
            'color': '#5b21b6',
          },
        },

        // Classes & Interfaces
        {
          selector: nodeTypeSelector(NodeType.Class),
          style: {
            'background-color': '#ecfdf5',
            'border-color': '#10b981',
            'color': '#065f46',
            'border-width': 2,
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Interface),
          style: {
            'background-color': '#fdf2f8',
            'border-color': '#ec4899',
            'color': '#9d174d',
            'border-style': 'dashed',
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Function),
          style: {
            'background-color': '#eff6ff',
            'border-color': '#3b82f6',
            'color': '#1e40af',
          },
        },
        {
          selector: nodeTypeSelector(NodeType.Variable),
          style: {
            'background-color': '#fffbeb',
            'border-color': '#f59e0b',
            'color': '#92400e',
          },
        },
        {
          selector: nodeTypeSelector(EXTERNAL_NODE_TYPE),
          style: {
            'background-color': '#f1f5f9',
            'border-color': '#cbd5e1',
            'color': '#64748b',
            'font-style': 'italic',
          },
        },

        // ── Visible, Clear Directed Edges ──
        {
          selector: SELECTOR.Edge,
          style: {
            'width': 2.5,
            'line-color': '#64748b',
            'target-arrow-color': '#64748b',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.1,
            'label': 'data(relation)',
            'font-size': '10px',
            'font-weight': 600,
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'color': '#475569',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.95,
            'text-background-padding': '2px',
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Imports),
          style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
            'color': '#7c3aed',
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Extends),
          style: {
            'line-color': '#ec4899',
            'target-arrow-color': '#ec4899',
            'line-style': 'dashed',
            'color': '#db2777',
          },
        },
        {
          selector: edgeRelationSelector(EdgeRelation.Calls),
          style: {
            'line-color': '#0284c7',
            'target-arrow-color': '#0284c7',
            'color': '#0369a1',
          },
        },

        // ── Interaction: Highlight on Select/Hover ──
        {
          selector: SELECTOR.SelectedOrHighlightedNode,
          style: {
            'border-width': 3,
            'border-color': '#2563eb',
            'opacity': 1,
          },
        },
        {
          selector: SELECTOR.SelectedEdge,
          style: {
            'width': 3.5,
            'opacity': 1,
          },
        },
        {
          selector: SELECTOR.Dimmed,
          style: {
            'opacity': 0.12,
          },
        },
      ],
    });

    // Run the clean dagre layout
    this.runLayout();

    // Tap handlers
    this.cytoscapeInstance.on('tap', SELECTOR.Node, (event: EventObject): void => {
      const nodeData: NodeElementData = event.target.data() as NodeElementData;
      this.selectedElement.set({
        type: nodeData.type,
        label: nodeData.label,
        role: nodeData.fileRole,
        filePath: nodeData.filePath,
      });
    });

    this.cytoscapeInstance.on('tap', SELECTOR.Edge, (event: EventObject): void => {
      const edgeData: EdgeElementData = event.target.data() as EdgeElementData;
      this.selectedElement.set({
        type: RELATIONSHIP_ELEMENT_TYPE,
        label: `${edgeData.source}${EDGE_LABEL_SEPARATOR}${edgeData.target}`,
        role: edgeData.relation,
        target: edgeData.target,
      });
    });

    this.cytoscapeInstance.on('tap', (event: EventObject): void => {
      if (event.target === this.cytoscapeInstance) {
        this.selectedElement.set(null);
      }
    });
  }
}
