import { Component, inject, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ICodeGraph } from '@devscape/shared';
import { CodeGraphService } from './services/code-graph.service';
import { GraphResultsComponent } from './components/graph-results/graph-results.component';
import { UNKNOWN_ERROR_MESSAGE } from './app.constants';

@Component({
  imports: [FormsModule, GraphResultsComponent],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly _codeGraphService: CodeGraphService = inject(CodeGraphService);

  protected readonly directoryPath: WritableSignal<string> = signal<string>('');
  protected readonly graph: WritableSignal<ICodeGraph | null> = signal<ICodeGraph | null>(null);
  protected readonly loading: WritableSignal<boolean> = signal<boolean>(false);
  protected readonly error: WritableSignal<string | null> = signal<string | null>(null);

  protected onSubmit(): void {
    const dirPath = this.directoryPath().trim();
    if (!dirPath) return;

    this.loading.set(true);
    this.error.set(null);
    this.graph.set(null);

    this._codeGraphService.parse(dirPath).subscribe({
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

  private getErrorMessage(error: unknown): string {
    if (typeof error !== 'object' || error === null) return UNKNOWN_ERROR_MESSAGE;

    const response = error as { error?: { message?: unknown }; message?: unknown };
    if (typeof response.error?.message === 'string') return response.error.message;
    if (typeof response.message === 'string') return response.message;
    return UNKNOWN_ERROR_MESSAGE;
  }
}
