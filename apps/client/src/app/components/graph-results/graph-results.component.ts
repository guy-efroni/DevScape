import { Component, Input, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ICodeGraph, ICodeNode, IGraphEdge } from '@devscape/shared';
import { ViewMode } from '../../app.constants';
import { GraphCanvasComponent } from '../graph-canvas/graph-canvas.component';

@Component({
  selector: 'app-graph-results',
  standalone: true,
  imports: [FormsModule, GraphCanvasComponent],
  templateUrl: './graph-results.component.html',
  styleUrl: './graph-results.component.scss',
})
export class GraphResultsComponent {
  @Input({ required: true }) public graph!: ICodeGraph;

  public readonly viewMode: WritableSignal<ViewMode> = signal<ViewMode>(ViewMode.Graph);
  public readonly ViewMode: typeof ViewMode = ViewMode;
  public readonly tableFilter: WritableSignal<string> = signal<string>('');

  public filteredNodes(nodes: ICodeNode[]): ICodeNode[] {
    const normalizedFilter: string = this.tableFilter().toLowerCase().trim();
    if (!normalizedFilter) return nodes;
    return nodes.filter(
      (node: ICodeNode): boolean =>
        node.name.toLowerCase().includes(normalizedFilter) ||
        node.type.toLowerCase().includes(normalizedFilter) ||
        node.filePath.toLowerCase().includes(normalizedFilter) ||
        (node.fileRole?.toLowerCase().includes(normalizedFilter) ?? false),
    );
  }

  public filteredEdges(edges: IGraphEdge[]): IGraphEdge[] {
    const normalizedFilter: string = this.tableFilter().toLowerCase().trim();
    if (!normalizedFilter) return edges;
    return edges.filter(
      (edge: IGraphEdge): boolean =>
        edge.source.toLowerCase().includes(normalizedFilter) ||
        edge.target.toLowerCase().includes(normalizedFilter) ||
        edge.relation.toLowerCase().includes(normalizedFilter),
    );
  }
}
