import { Component, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CodeGraphService } from './services/code-graph.service';
import type { ICodeGraph } from '@devscape/shared';

@Component({
  imports: [FormsModule],
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
        this.error.set(err?.error?.message ?? err?.message ?? 'Unknown error');
        this.loading.set(false);
      },
    });
  }
}
