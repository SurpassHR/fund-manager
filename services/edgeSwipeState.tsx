import React, { createContext, useContext, useMemo, useState } from 'react';

type Edge = 'left' | 'right' | null;

type DragState = {
  isDragging: boolean;
  dragX: number;
  edge: Edge;
  activeOverlayId: string | null;
  closeTargetX: number | null;
  snapBackX: number | null;
};

type DragContextValue = DragState & {
  setDragState: React.Dispatch<React.SetStateAction<DragState>>;
};

const defaultState: DragState = {
  isDragging: false,
  dragX: 0,
  edge: null,
  activeOverlayId: null,
  closeTargetX: null,
  snapBackX: null,
};

const DragContext = createContext<DragContextValue | null>(null);

export const EdgeSwipeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setDragState] = useState<DragState>(defaultState);
  const value = useMemo(() => ({ ...state, setDragState }), [state]);
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
};

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
