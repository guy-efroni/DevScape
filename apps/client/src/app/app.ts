import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeGraphService } from './services/code-graph.service';
import { GraphCanvasComponent } from './components/graph-canvas/graph-canvas.component';
import type { ICodeGraph } from '@devscape/shared';
import { UNKNOWN_ERROR_MESSAGE, ViewMode } from './app.constants';

@Component({
  imports: [FormsModule, GraphCanvasComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly codeGraphService = inject(CodeGraphService);

  protected readonly directoryPath = signal('');
  protected readonly graph = signal<ICodeGraph | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly viewMode = signal<ViewMode>(ViewMode.Graph);
  protected readonly ViewMode = ViewMode;
  protected readonly tableFilter = signal('');

  protected readonly presets = [
    { label: 'Server Source', path: 'apps/server/src' },
    { label: 'Shared Interfaces', path: 'packages/shared/src' },
    { label: 'Client App', path: 'apps/client/src/app' },
  ];

  protected selectPreset(presetPath: string): void {
    this.directoryPath.set(presetPath);
    this.onSubmit();
  }

  protected onSubmit(): void {
    const dirPath = this.directoryPath().trim();
    if (!dirPath) return;

    this.loading.set(true);
    this.error.set(null);
    this.graph.set(null);

    this.codeGraphService.parse(dirPath).subscribe({
      next: (result) => {
        this.graph.set(result);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? err?.message ?? UNKNOWN_ERROR_MESSAGE);
        this.loading.set(false);
      },
    });
  }

  protected filteredNodes(nodes: ICodeGraph['nodes']) {
    const q = this.tableFilter().toLowerCase().trim();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q) ||
        n.filePath.toLowerCase().includes(q) ||
        (n.fileRole && n.fileRole.toLowerCase().includes(q)),
    );
  }

  protected filteredEdges(edges: ICodeGraph['edges']) {
    const q = this.tableFilter().toLowerCase().trim();
    if (!q) return edges;
    return edges.filter(
      (e) =>
        e.source.toLowerCase().includes(q) ||
        e.target.toLowerCase().includes(q) ||
        e.relation.toLowerCase().includes(q),
    );
  }
}
