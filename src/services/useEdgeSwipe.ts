import { useContext } from 'react';
import { DragContext, defaultState } from './edgeSwipeContext';
import type { DragState } from './edgeSwipeContext';

export const useEdgeSwipe = () => {
  const ctx = useContext(DragContext);
  if (!ctx) {
    throw new Error('useEdgeSwipe must be used within EdgeSwipeProvider');
  }
  return ctx;
};

export const resetDragState = (setDragState: React.Dispatch<React.SetStateAction<DragState>>) => {
  setDragState(() => defaultState);
};
