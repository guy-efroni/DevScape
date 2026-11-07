import type { EdgeRelation } from '@devscape/shared';

export interface EdgeElementData {
  id: string;
  source: string;
  target: string;
  relation: EdgeRelation;
}
