import { Component, Input, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ICodeGraph } from '@devscape/shared';
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
  public readonly ViewMode = ViewMode;
  public readonly tableFilter: WritableSignal<string> = signal<string>('');

  public filteredNodes(nodes: ICodeGraph['nodes']): ICodeGraph['nodes'] {
    const normalizedFilter = this.tableFilter().toLowerCase().trim();
    if (!normalizedFilter) return nodes;
    return nodes.filter(
      (node) =>
        node.name.toLowerCase().includes(normalizedFilter) ||
        node.type.toLowerCase().includes(normalizedFilter) ||
        node.filePath.toLowerCase().includes(normalizedFilter) ||
        (node.fileRole && node.fileRole.toLowerCase().includes(normalizedFilter)),
    );
  }

  public filteredEdges(edges: ICodeGraph['edges']): ICodeGraph['edges'] {
    const normalizedFilter = this.tableFilter().toLowerCase().trim();
    if (!normalizedFilter) return edges;
    return edges.filter(
      (edge) =>
        edge.source.toLowerCase().includes(normalizedFilter) ||
        edge.target.toLowerCase().includes(normalizedFilter) ||
        edge.relation.toLowerCase().includes(normalizedFilter),
    );
  }
}
