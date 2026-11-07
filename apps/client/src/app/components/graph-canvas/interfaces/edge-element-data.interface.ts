import type { EdgeRelation } from '@devscape/shared';

export interface IEdgeElementData {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
}
