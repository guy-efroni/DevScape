import { Component, EventEmitter, Input, Output, signal, WritableSignal } from '@angular/core';
import type { EdgeRelation } from '@devscape/shared';
import type { ISelectedElement } from '../graph-canvas/interfaces/selected-element.interface';
import type { ISelectedRelation } from '../graph-canvas/interfaces/selected-relation.interface';

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

  public referenceLine(r: ISelectedRelation): string {
    const raw = r.targetId ?? r.connectedNode;
    const spec = this._specifier(raw);
    const name = this._displayName(r.connectedNode);
    switch (r.relation as EdgeRelation | string) {
      case 'imports':
        return `import { ${name} } from '${spec}';`;
      case 'extends':
        return `extends ${name}`;
      case 'calls':
        return `${name}()`;
      default:
        return `${r.relation} ${spec}`;
    }
  }

  private _specifier(id: string): string {
    if (!id) return id;
    const clean = id.split('#')[0].replace(/\\/g, '/');
    if (!clean.startsWith('.') && !clean.includes('/')) return clean;
    const scoped = clean.match(/(@[^/]+\/[^/]+)/);
    if (scoped) return scoped[1];
    const base = clean.split('/').pop() ?? clean;
    return base.replace(/\.(?:d\.)?[cm]?[jt]sx?$/i, '');
  }

  private _displayName(id: string): string {
    if (!id) return id;
    const base = id.replace(/\\/g, '/').split('/').pop() ?? id;
    const hash = base.indexOf('#');
    return hash >= 0 ? base.slice(hash + 1) : base;
  }
}
