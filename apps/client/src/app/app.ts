import { Component, inject, signal, WritableSignal } from '@angular/core';
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
  private readonly codeGraphService: CodeGraphService = inject(CodeGraphService);

  protected readonly directoryPath: WritableSignal<string> = signal<string>('');
  protected readonly graph: WritableSignal<ICodeGraph | null> = signal<ICodeGraph | null>(null);
  protected readonly loading: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly error: WritableSignal<string | null> = signal<string | null>(null);
  protected readonly viewMode: WritableSignal<ViewMode> = signal<ViewMode>(ViewMode.Graph);
  protected readonly ViewMode = ViewMode;
  protected readonly tableFilter: WritableSignal<string> = signal<string>('');

  protected readonly presets: ReadonlyArray<{ label: string; path: string }> = [
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
      error: (requestError: unknown) => {
        this.error.set(this.getErrorMessage(requestError));
        this.loading.set(false);
      },
    });
  }

  protected filteredNodes(nodes: ICodeGraph['nodes']): ICodeGraph['nodes'] {
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

  protected filteredEdges(edges: ICodeGraph['edges']): ICodeGraph['edges'] {
    const normalizedFilter = this.tableFilter().toLowerCase().trim();
    if (!normalizedFilter) return edges;
    return edges.filter(
      (edge) =>
        edge.source.toLowerCase().includes(normalizedFilter) ||
        edge.target.toLowerCase().includes(normalizedFilter) ||
        edge.relation.toLowerCase().includes(normalizedFilter),
    );
  }

  private getErrorMessage(error: unknown): string {
    if (typeof error !== 'object' || error === null) return UNKNOWN_ERROR_MESSAGE;

    const response = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof response.error?.message === 'string') return response.error.message;
    if (typeof response.message === 'string') return response.message;
    return UNKNOWN_ERROR_MESSAGE;
  }
}
