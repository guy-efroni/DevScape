import type { ISelectedRelation } from './selected-relation.interface';

export interface ISelectedElement {
  type: string;
  label: string;
  role?: string;
  filePath?: string;
  target?: string;
  relations: ISelectedRelation[];
}
