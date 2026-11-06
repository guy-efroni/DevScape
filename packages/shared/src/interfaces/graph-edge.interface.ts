export interface IGraphEdge {
    source: string;
    target: string;
    relation: 'imports' | 'extends' | 'calls';
}