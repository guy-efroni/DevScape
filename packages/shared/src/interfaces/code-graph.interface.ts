import { ICodeNode } from './code-node.interface.js';
import { IGraphEdge } from './graph-edge.interface.js';

export interface ICodeGraph {
    nodes: ICodeNode[];
    edges: IGraphEdge[];
}