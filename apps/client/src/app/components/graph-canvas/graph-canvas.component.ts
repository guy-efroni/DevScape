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
  template: `
    <div class="canvas-container">
      <div class="canvas-toolbar">
        <div class="legend">
          <span class="legend-item"><span class="dot file"></span> File</span>
          <span class="legend-item"><span class="dot class"></span> Class</span>
          <span class="legend-item"><span class="dot interface"></span> Interface</span>
          <span class="legend-item"><span class="dot function"></span> Function</span>
          <span class="legend-item"><span class="dot variable"></span> Variable</span>
          <span class="legend-item"><span class="dot external"></span> External / Module</span>
        </div>
        <div class="toolbar-actions">
          <button type="button" class="btn-tool" (click)="fitView()">🎯 Fit</button>
          <button type="button" class="btn-tool" (click)="reRunLayout('cose')">🕸️ Force</button>
          <button type="button" class="btn-tool" (click)="reRunLayout('breadthfirst')">🌳 Tree</button>
          <button type="button" class="btn-tool" (click)="reRunLayout('circle')">⭕ Circle</button>
        </div>
      </div>

      <div #cyContainer class="cy-viewport"></div>

      @if (selectedNode(); as node) {
        <div class="node-details">
          <h4>{{ node.label }}</h4>
          <p><strong>Type:</strong> {{ node.type }}</p>
          @if (node.filePath) {
            <p><strong>File:</strong> <code>{{ node.filePath }}</code></p>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .canvas-container {
      position: relative;
      width: 100%;
      height: 600px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
      background: #ffffff;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
      margin-top: 1rem;
    }

    .canvas-toolbar {
      position: absolute;
      top: 10px;
      left: 10px;
      right: 10px;
      z-index: 10;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(4px);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      font-size: 0.82rem;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 500;
      color: #475569;
    }

    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }
    .dot.file { background: #8b5cf6; }
    .dot.class { background: #10b981; }
    .dot.interface { background: #ec4899; }
    .dot.function { background: #3b82f6; }
    .dot.variable { background: #f59e0b; }
    .dot.external { background: #94a3b8; }

    .toolbar-actions {
      display: flex;
      gap: 6px;
    }

    .btn-tool {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 0.78rem;
      cursor: pointer;
      font-weight: 600;
      color: #334155;
      transition: background 0.15s;

      &:hover {
        background: #e2e8f0;
      }
    }

    .cy-viewport {
      width: 100%;
      height: 100%;
    }

    .node-details {
      position: absolute;
      bottom: 12px;
      right: 12px;
      z-index: 10;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(4px);
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
      max-width: 320px;
      font-size: 0.85rem;

      h4 {
        margin: 0 0 4px;
        font-size: 0.95rem;
        color: #1e293b;
      }
      p {
        margin: 2px 0;
        color: #475569;
      }
      code {
        font-size: 0.8rem;
        background: #f1f5f9;
        padding: 2px 4px;
        border-radius: 3px;
      }
    }
  `],
})
export class GraphCanvasComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) graph!: ICodeGraph;
  @ViewChild('cyContainer', { static: true }) cyContainer!: ElementRef<HTMLDivElement>;

  private cy: Core | null = null;
  protected selectedNode = signal<{ label: string; type: string; filePath?: string } | null>(null);

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
    this.cy?.fit(undefined, 30);
  }

  reRunLayout(name: string): void {
    if (!this.cy) return;
    const layout = this.cy.layout({
      name,
      animate: true,
      animationDuration: 500,
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

    // 1. Add explicitly parsed nodes
    for (const node of this.graph.nodes) {
      nodeIds.add(node.id);
      elements.push({
        group: 'nodes',
        data: {
          id: node.id,
          label: node.name,
          type: node.type,
          filePath: node.filePath,
        },
      });
    }

    // 2. Add edges, creating placeholder nodes for any external imports or targets not in nodeIds
    let edgeCounter = 0;
    for (const edge of this.graph.edges) {
      // Ensure source node exists
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

      // Ensure target node exists
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
            'width': 28,
            'height': 28,
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'node[type = "file"]',
          style: {
            'background-color': '#8b5cf6',
            'shape': 'round-rectangle',
            'width': 34,
            'height': 34,
          },
        },
        {
          selector: 'node[type = "class"]',
          style: {
            'background-color': '#10b981',
            'shape': 'ellipse',
            'width': 30,
            'height': 30,
          },
        },
        {
          selector: 'node[type = "interface"]',
          style: {
            'background-color': '#ec4899',
            'shape': 'diamond',
            'width': 30,
            'height': 30,
          },
        },
        {
          selector: 'node[type = "function"]',
          style: {
            'background-color': '#3b82f6',
            'shape': 'ellipse',
            'width': 26,
            'height': 26,
          },
        },
        {
          selector: 'node[type = "variable"]',
          style: {
            'background-color': '#f59e0b',
            'shape': 'rectangle',
            'width': 24,
            'height': 24,
          },
        },
        {
          selector: 'node[type = "external"]',
          style: {
            'background-color': '#cbd5e1',
            'shape': 'ellipse',
            'opacity': 0.8,
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

