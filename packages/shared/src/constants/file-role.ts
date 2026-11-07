/** Architectural role assigned to a file node. */
export const FileRole = {
  Controller: 'controller',
  Service: 'service',
  Component: 'component',
  Module: 'module',
  Dto: 'dto',
  Interface: 'interface',
  Config: 'config',
  Barrel: 'barrel',
  Generic: 'generic',
} as const;

export type FileRole = (typeof FileRole)[keyof typeof FileRole];
