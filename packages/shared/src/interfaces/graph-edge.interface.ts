import type { EdgeRelation } from '../constants/edge-relation.js';

export interface IGraphEdge {
    source: string;
    target: string;
    relation: EdgeRelation;
}
