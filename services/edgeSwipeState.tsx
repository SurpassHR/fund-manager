import React, { useMemo, useState } from 'react';
import { DragContext, defaultState } from './edgeSwipeContext';
import type { DragState } from './edgeSwipeContext';

export const EdgeSwipeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setDragState] = useState<DragState>(defaultState);
  const value = useMemo(() => ({ ...state, setDragState }), [state]);
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
};
