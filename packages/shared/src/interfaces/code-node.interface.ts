import type { FileRole } from '../constants/file-role.js';
import type { NodeType } from '../constants/node-type.js';

export interface ICodeNode {
  id: string;
  name: string;
  type: NodeType;
  filePath: string;
  /** Specific architectural role when type is the file node type */
  fileRole?: FileRole;
  /** Parent container ID (e.g. file node id for compound visual nesting) */
  parent?: string;
  /** Lines of code (physical LOC of the file or node range) */
  loc?: number;
  /** Cyclomatic complexity (computed for functions/classes; file-level may aggregate) */
  cyclomaticComplexity?: number;
}
