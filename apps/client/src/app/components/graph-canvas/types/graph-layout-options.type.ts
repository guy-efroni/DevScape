import type { LayoutOptions } from 'cytoscape';
import { RankDirection } from '../graph-canvas.constants';

export type GraphLayoutOptions = LayoutOptions & {
  animate?: boolean;
  animationDuration?: number;
  nodeSep?: number;
  padding?: number;
  rankSep?: number;
  rankDir?: (typeof RankDirection)[keyof typeof RankDirection];
};
