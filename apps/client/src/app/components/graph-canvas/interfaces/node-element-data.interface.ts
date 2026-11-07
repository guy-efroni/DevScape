import type { FileRole } from '@devscape/shared';

export interface INodeElementData {
  id: string;
  label: string;
  type: string;
  fileRole?: FileRole;
  filePath?: string;
  loc?: number;
  cyclomaticComplexity?: number;
}
