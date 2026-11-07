import type { EdgeRelation } from '@devscape/shared';

export interface ISelectedRelation {
  relation: EdgeRelation;
  direction: 'incoming' | 'outgoing';
  connectedNode: string;
}
