import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import type { ICodeGraph, ICodeNode } from '@devscape/shared';

// Register dagre layout plugin with cytoscape
cytoscape.use(dagre);

type ViewFilter = 'architecture' | 'files-only' | 'all';
type LayoutDirection = 'dagre-lr' | 'dagre-tb' | 'grid';

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

  private cy: Core | null = null;

  protected viewFilter = signal<ViewFilter>('architecture');
  protected activeLayout = signal<LayoutDirection>('dagre-lr');
  protected showExternal = signal(false);
  protected searchTerm = signal('');

  protected selectedElement = signal<{
    type: string;
    label: string;
    role?: string;
    filePath?: string;
    target?: string;
  } | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['graph'] && this.graph) {
      this.renderGraph();
    }
  }

  ngOnDestroy(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
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
    this.cy?.fit(undefined, 50);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (!this.cy) return;

    this.cy.batch(() => {
      if (!term.trim()) {
        this.cy!.$('node, edge').removeClass('highlighted dimmed');
        return;
      }

      const q = term.toLowerCase().trim();
      const matchedNodes = this.cy!.$(`node[label *= "${q}"]`);
      this.cy!.$('node, edge').addClass('dimmed').removeClass('highlighted');
      matchedNodes.removeClass('dimmed').addClass('highlighted');
      matchedNodes.connectedEdges().removeClass('dimmed').addClass('highlighted');
    });
  }

  private runLayout(): void {
    if (!this.cy) return;

    const layoutName = this.activeLayout();
    let config: any;

    if (layoutName === 'dagre-lr') {
      config = {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 60,
        rankSep: 90,
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    } else if (layoutName === 'dagre-tb') {
      config = {
        name: 'dagre',
        rankDir: 'TB',
        nodeSep: 60,
        rankSep: 90,
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    } else {
      config = {
        name: 'grid',
        animate: true,
        animationDuration: 500,
        padding: 50,
      };
    }

    this.cy.layout(config).run();
  }

  private renderGraph(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }

    const elements: ElementDefinition[] = [];
    const allowedNodeIds = new Set<string>();

    const filter = this.viewFilter();
    const includeExternal = this.showExternal();

    // 1. Filter Nodes based on selected view mode
    const filteredNodes = this.graph.nodes.filter((node) => {
      if (filter === 'files-only') {
        return node.type === 'file';
      }
      if (filter === 'architecture') {
        // High-level: Only Files, Classes, and Interfaces. Filter out variables and minor functions.
        return node.type === 'file' || node.type === 'class' || node.type === 'interface';
      }
      // 'all': Show everything
      return true;
    });

    for (const node of filteredNodes) {
      allowedNodeIds.add(node.id);
      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.type === 'file' ? `📁 ${node.name}` : node.name,
          type: node.type,
          fileRole: node.fileRole,
          filePath: node.filePath,
        },
      });
    }

    // 2. Filter & Add Edges
    let edgeIndex = 0;
    for (const edge of this.graph.edges) {
      const sourceExists = allowedNodeIds.has(edge.source);
      const targetExists = allowedNodeIds.has(edge.target);

      // If both endpoints exist in our filtered set, connect directly
      if (sourceExists && targetExists) {
        elements.push({
          group: 'edges',
          data: {
            id: `edge-${edgeIndex++}`,
            source: edge.source,
            target: edge.target,
            relation: edge.relation,
          },
        });
        continue;
      }

      // If edge targets an external library and user has external toggled on:
      if (includeExternal && sourceExists && !targetExists) {
        if (!allowedNodeIds.has(edge.target)) {
          allowedNodeIds.add(edge.target);
          elements.push({
            group: 'nodes',
            data: {
              id: edge.target,
              label: edge.target,
              type: 'external',
            },
          });
        }
        elements.push({
          group: 'edges',
          data: {
            id: `edge-${edgeIndex++}`,
            source: edge.source,
            target: edge.target,
            relation: edge.relation,
          },
        });
      }
    }

    // 3. Initialize Cytoscape with crisp, uncluttered styles
    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      style: [
        // ── Clean Card Nodes ──
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'font-family': 'Inter, system-ui, sans-serif',
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
            'padding': '10px',
          },
        },

        // Role-based borders & tints for files
        {
          selector: 'node[type = "file"]',
          style: {
            'background-color': '#f8fafc',
            'border-color': '#64748b',
            'font-weight': 700,
          },
        },
        {
          selector: 'node[fileRole = "controller"]',
          style: {
            'background-color': '#faf5ff',
            'border-color': '#a855f7',
            'color': '#6b21a8',
          },
        },
        {
          selector: 'node[fileRole = "service"]',
          style: {
            'background-color': '#ecfeff',
            'border-color': '#06b6d4',
            'color': '#0e7490',
          },
        },
        {
          selector: 'node[fileRole = "component"]',
          style: {
            'background-color': '#eef2ff',
            'border-color': '#6366f1',
            'color': '#3730a3',
          },
        },
        {
          selector: 'node[fileRole = "module"]',
          style: {
            'background-color': '#f5f3ff',
            'border-color': '#8b5cf6',
            'color': '#5b21b6',
          },
        },

        // Classes & Interfaces
        {
          selector: 'node[type = "class"]',
          style: {
            'background-color': '#ecfdf5',
            'border-color': '#10b981',
            'color': '#065f46',
            'border-width': 2,
          },
        },
        {
          selector: 'node[type = "interface"]',
          style: {
            'background-color': '#fdf2f8',
            'border-color': '#ec4899',
            'color': '#9d174d',
            'border-style': 'dashed',
          },
        },
        {
          selector: 'node[type = "function"]',
          style: {
            'background-color': '#eff6ff',
            'border-color': '#3b82f6',
            'color': '#1e40af',
          },
        },
        {
          selector: 'node[type = "variable"]',
          style: {
            'background-color': '#fffbeb',
            'border-color': '#f59e0b',
            'color': '#92400e',
          },
        },
        {
          selector: 'node[type = "external"]',
          style: {
            'background-color': '#f1f5f9',
            'border-color': '#cbd5e1',
            'color': '#64748b',
            'font-style': 'italic',
          },
        },

        // ── Clean Uncluttered Edges ──
        // NO text label by default!
        {
          selector: 'edge',
          style: {
            'width': 2,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'opacity': 0.7,
          },
        },
        {
          selector: 'edge[relation = "imports"]',
          style: {
            'line-color': '#8b5cf6',
            'target-arrow-color': '#8b5cf6',
          },
        },
        {
          selector: 'edge[relation = "extends"]',
          style: {
            'line-color': '#ec4899',
            'target-arrow-color': '#ec4899',
            'line-style': 'dashed',
          },
        },
        {
          selector: 'edge[relation = "calls"]',
          style: {
            'line-color': '#0284c7',
            'target-arrow-color': '#0284c7',
          },
        },

        // ── Interaction: Highlight on Select/Hover ──
        {
          selector: 'node:selected, node.highlighted',
          style: {
            'border-width': 3,
            'border-color': '#2563eb',
            'opacity': 1,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'width': 3,
            'label': 'data(relation)',
            'font-size': '10px',
            'font-weight': 700,
            'color': '#1e293b',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': '3px',
            'opacity': 1,
          },
        },
        {
          selector: 'node.dimmed, edge.dimmed',
          style: {
            'opacity': 0.1,
          },
        },
      ],
    });

    // Run the clean dagre layout
    this.runLayout();

    // Tap handlers
    this.cy.on('tap', 'node', (evt) => {
      const d = evt.target.data();
      this.selectedElement.set({
        type: d.type,
        label: d.label,
        role: d.fileRole,
        filePath: d.filePath,
      });
    });

    this.cy.on('tap', 'edge', (evt) => {
      const d = evt.target.data();
      this.selectedElement.set({
        type: 'relationship',
        label: `${d.source} ➔ ${d.target}`,
        role: d.relation,
        target: d.target,
      });
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.selectedElement.set(null);
      }
    });
  }
}
