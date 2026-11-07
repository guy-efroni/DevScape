import type { FileRole } from '@devscape/shared';

export interface NodeElementData {
  id: string;
  label: string;
  type: string;
  fileRole?: FileRole;
  filePath?: string;
}
