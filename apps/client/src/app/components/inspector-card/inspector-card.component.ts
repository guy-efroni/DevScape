import { Component, EventEmitter, Input, Output, signal, WritableSignal } from '@angular/core';
import { EdgeRelation } from '@devscape/shared';
import type { ISelectedElement } from '../graph-canvas/interfaces/selected-element.interface';
import type { ISelectedRelation } from '../graph-canvas/interfaces/selected-relation.interface';

export const INSPECTOR_UI = {
  ariaLabel: 'Node inspector',
  metrics: 'METRICS',
  loc: 'LOC',
  cyclomatic: 'CYCLOMATIC',
  inbound: 'INBOUND',
  outbound: 'OUTBOUND',
  codeReferences: 'CODE REFERENCES',
  noReferences: 'No references',
  close: 'Close inspector',
  metricFallback: '—',
} as const;

const PATH_SEPARATOR: string = '/';
const WINDOWS_PATH_SEPARATOR_PATTERN: RegExp = /\\/g;
const NODE_ID_FRAGMENT_SEPARATOR: string = '#';
const SCOPED_PACKAGE_PATTERN: RegExp = /(@[^/]+\/[^/]+)/;
const MODULE_EXTENSION_PATTERN = /\.(?:d\.)?[cm]?[jt]sx?$/i;
const REFERENCE_KEYWORD_EXTENDS: string = 'extends';

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
  public readonly ui = INSPECTOR_UI;

  public toggleRelations(): void {
    this.relationsExpanded.update((expanded: boolean): boolean => !expanded);
  }

  public referenceLine(relation: ISelectedRelation): string {
    const raw: string = relation.targetId ?? relation.connectedNode;
    const spec: string = this._specifier(raw);
    const name: string = this._displayName(relation.connectedNode);
    switch (relation.relation) {
      case EdgeRelation.Imports:
        return `import { ${name} } from '${spec}';`;
      case EdgeRelation.Extends:
        return `${REFERENCE_KEYWORD_EXTENDS} ${name}`;
      case EdgeRelation.Calls:
        return `${name}()`;
      default:
        return `${relation.relation} ${spec}`;
    }
  }

  private _specifier(id: string): string {
    if (!id) return id;
    const clean: string = id.split(NODE_ID_FRAGMENT_SEPARATOR)[0].replace(WINDOWS_PATH_SEPARATOR_PATTERN, PATH_SEPARATOR);
    if (!clean.startsWith('.') && !clean.includes(PATH_SEPARATOR)) return clean;
    const scoped: RegExpMatchArray | null = clean.match(SCOPED_PACKAGE_PATTERN);
    if (scoped) return scoped[1];
    const base: string = clean.split(PATH_SEPARATOR).pop() ?? clean;
    return base.replace(MODULE_EXTENSION_PATTERN, '');
  }

  private _displayName(id: string): string {
    if (!id) return id;
    const base: string = id.replace(WINDOWS_PATH_SEPARATOR_PATTERN, PATH_SEPARATOR).split(PATH_SEPARATOR).pop() ?? id;
    const hash: number = base.indexOf(NODE_ID_FRAGMENT_SEPARATOR);
    return hash >= 0 ? base.slice(hash + 1) : base;
  }
}
