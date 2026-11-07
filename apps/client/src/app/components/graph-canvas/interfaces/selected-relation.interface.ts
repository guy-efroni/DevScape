import type { EdgeRelation } from '@devscape/shared';
import type { RelationDirection } from '../enums/relation-direction.enum';

export interface ISelectedRelation {
  relation: EdgeRelation;
  direction: RelationDirection;
  connectedNode: string;
  targetId?: string;
  sourceId?: string;
}
