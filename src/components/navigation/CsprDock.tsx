import React from 'react';
import {
  CsprNavigationRail,
  type CsprNavigationRailProps,
  type CsprTab,
} from '../cspr/CsprNavigationRail';

export type { CsprNavigationRailProps, CsprTab };
export { CsprNavigationRail };

/**
 * CsprDock - Border-attached dock navigation using Audiowide typography
 */
export const CsprDock: React.FC<CsprNavigationRailProps> = (props) => {
  return <CsprNavigationRail {...props} />;
};

export default CsprDock;
