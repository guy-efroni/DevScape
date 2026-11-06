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
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import type { ICodeGraph } from '@devscape/shared';

@Component({
  selector: 'app-graph-canvas',
  standalone: true,
  templateUrl: './graph-canvas.component.html',
  styleUrl: './graph-canvas.component.scss',
})
export class GraphCanvasComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) graph!: ICodeGraph;
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef<HTMLDivElement>;

  private cy: Core | null = null;
  protected selectedNode = signal<{ label: string; type: string; fileRole?: string; filePath?: string } | null>(null);

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

  fitView(): void {
    this.cy?.fit(undefined, 35);
  }

  reRunLayout(name: string): void {
    if (!this.cy) return;
    const layout = this.cy.layout({
      name,
      animate: true,
      animationDuration: 500,
      padding: 40,
    } as any);
    layout.run();
  }

  private renderGraph(): void {
    if (this.cy) {
      this.cy.destroy();
      this.cy = null;
    }

    const elements: ElementDefinition[] = [];
    const nodeIds = new Set<string>();

    // 1. Add file parent nodes first
    for (const node of this.graph.nodes) {
      if (node.type === 'file') {
        nodeIds.add(node.id);
        elements.push({
          group: 'nodes',
          data: {
            id: node.id,
            label: `📄 ${node.name}`,
            type: 'file',
            fileRole: node.fileRole ?? 'generic',
            filePath: node.filePath,
          },
        });
      }
    }

    // 2. Add child symbol nodes (classes, interfaces, functions, variables)
    for (const node of this.graph.nodes) {
      if (node.type !== 'file') {
        nodeIds.add(node.id);
        elements.push({
          group: 'nodes',
          data: {
            id: node.id,
            label: node.name,
            type: node.type,
            filePath: node.filePath,
            parent: node.parent && nodeIds.has(node.parent) ? node.parent : undefined,
          },
        });
      }
    }

    // 3. Add edges, creating external placeholder nodes for external modules
    let edgeCounter = 0;
    for (const edge of this.graph.edges) {
      if (!nodeIds.has(edge.source)) {
        nodeIds.add(edge.source);
        elements.push({
          group: 'nodes',
          data: {
            id: edge.source,
            label: edge.source,
            type: 'external',
          },
        });
      }

      if (!nodeIds.has(edge.target)) {
        nodeIds.add(edge.target);
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
          id: `edge-${edgeCounter++}`,
          source: edge.source,
          target: edge.target,
          relation: edge.relation,
        },
      });
    }

    this.cy = cytoscape({
      container: this.cyContainer.nativeElement,
      elements,
      style: [
        // Default base node
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'color': '#1e293b',
            'font-size': '11px',
            'font-family': 'Inter, system-ui, sans-serif',
            'text-valign': 'bottom',
            'text-margin-y': 4,
            'background-color': '#94a3b8',
            'width': 26,
            'height': 26,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        // Compound Parent Container (File) Styling
        {
          selector: ':parent',
          style: {
            'text-valign': 'top',
            'text-halign': 'center',
            'text-margin-y': -8,
            'font-size': '12px',
            'font-weight': 'bold',
            'color': '#334155',
            'background-color': 'rgba(241, 245, 249, 0.6)',
            'border-width': 1.5,
            'border-style': 'dashed',
            'border-color': '#94a3b8',
            'padding': '18px',
          },
        },
        {
          selector: ':parent[fileRole = "controller"]',
          style: {
            'background-color': 'rgba(124, 58, 237, 0.05)',
            'border-color': '#7c3aed',
            'color': '#6d28d9',
          },
        },
        {
          selector: ':parent[fileRole = "service"]',
          style: {
            'background-color': 'rgba(6, 182, 212, 0.05)',
            'border-color': '#06b6d4',
            'color': '#0e7490',
          },
        },
        {
          selector: ':parent[fileRole = "component"]',
          style: {
            'background-color': 'rgba(79, 70, 229, 0.05)',
            'border-color': '#4f46e5',
            'color': '#4338ca',
          },
        },
        {
          selector: ':parent[fileRole = "module"]',
          style: {
            'background-color': 'rgba(99, 102, 241, 0.05)',
            'border-color': '#6366f1',
            'color': '#4f46e5',
          },
        },
        {
          selector: ':parent[fileRole = "dto"]',
          style: {
            'background-color': 'rgba(217, 119, 6, 0.05)',
            'border-color': '#d97706',
            'color': '#b45309',
          },
        },
        // Child Symbol styling
        {
          selector: 'node[type = "class"]',
          style: {
            'background-color': '#10b981',
            'shape': 'ellipse',
            'width': 28,
            'height': 28,
          },
        },
        {
          selector: 'node[type = "interface"]',
          style: {
            'background-color': '#ec4899',
            'shape': 'diamond',
            'width': 28,
            'height': 28,
          },
        },
        {
          selector: 'node[type = "function"]',
          style: {
            'background-color': '#3b82f6',
            'shape': 'ellipse',
            'width': 24,
            'height': 24,
          },
        },
        {
          selector: 'node[type = "variable"]',
          style: {
            'background-color': '#f59e0b',
            'shape': 'round-rectangle',
            'width': 22,
            'height': 22,
          },
        },
        {
          selector: 'node[type = "external"]',
          style: {
            'background-color': '#cbd5e1',
            'shape': 'round-rectangle',
            'opacity': 0.85,
            'width': 22,
            'height': 22,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 3,
            'border-color': '#2563eb',
            'border-opacity': 1,
          },
        },
        // Edge styling
        {
          selector: 'edge',
          style: {
            'width': 1.5,
            'line-color': '#94a3b8',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.8,
            'label': 'data(relation)',
            'font-size': '9px',
            'text-rotation': 'autorotate',
            'text-margin-y': -8,
            'color': '#64748b',
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
            'line-color': '#3b82f6',
            'target-arrow-color': '#3b82f6',
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeDimensionsIncludeLabels: true,
        padding: 40,
      } as any,
    });

    this.cy.on('tap', 'node', (evt) => {
      const nodeData = evt.target.data();
      this.selectedNode.set({
        label: nodeData.label,
        type: nodeData.type,
        fileRole: nodeData.fileRole,
        filePath: nodeData.filePath,
      });
    });

    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) {
        this.selectedNode.set(null);
      }
    });
  }
}
