export type FileRole =
  | 'controller'
  | 'service'
  | 'component'
  | 'module'
  | 'dto'
  | 'interface'
  | 'config'
  | 'barrel'
  | 'generic';

export interface ICodeNode {
  id: string;
  name: string;
  type: 'class' | 'function' | 'interface' | 'variable' | 'file';
  filePath: string;
  /** Specific architectural role when type === 'file' */
  fileRole?: FileRole;
  /** Parent container ID (e.g. file node id for compound visual nesting) */
  parent?: string;
}
