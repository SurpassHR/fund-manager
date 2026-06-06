import { createContext } from 'react';
import type React from 'react';

type Edge = 'left' | 'right' | null;

export type DragState = {
  isDragging: boolean;
  dragX: number;
  edge: Edge;
  activeOverlayId: string | null;
  closeTargetX: number | null;
  snapBackX: number | null;
};

export type DragContextValue = DragState & {
  setDragState: React.Dispatch<React.SetStateAction<DragState>>;
};

export const defaultState: DragState = {
  isDragging: false,
  dragX: 0,
  edge: null,
  activeOverlayId: null,
  closeTargetX: null,
  snapBackX: null,
};

export const DragContext = createContext<DragContextValue | null>(null);
