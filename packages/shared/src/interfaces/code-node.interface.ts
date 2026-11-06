export interface ICodeNode {
    id: string;
    name: string;
    type: 'class' | 'function' | 'interface' | 'variable' | 'file';
    filePath: string;
}