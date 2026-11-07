import { Component, EventEmitter, Input, Output, signal, WritableSignal } from '@angular/core';
import type { ISelectedElement } from '../graph-canvas/interfaces/selected-element.interface';

@Component({
  selector: 'app-inspector-card',
  standalone: true,
  templateUrl: './inspector-card.component.html',
  styleUrl: './inspector-card.component.scss',
})
export class InspectorCardComponent {
  @Input({ required: true }) public selectedElement!: ISelectedElement;
  @Output() public readonly closed: EventEmitter<void> = new EventEmitter<void>();

  public readonly relationsExpanded: WritableSignal<boolean> = signal<boolean>(true);

  public toggleRelations(): void {
    this.relationsExpanded.update((expanded: boolean): boolean => !expanded);
  }
}
