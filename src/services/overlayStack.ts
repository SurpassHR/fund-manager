type ClosePayload = { source?: 'edge-swipe' | 'programmatic'; targetX?: number };
type RequestClose = (payload?: ClosePayload) => void;

type Entry = { id: string; requestClose: RequestClose };

const stack: Entry[] = [];

export const registerOverlay = (id: string, requestClose: RequestClose) => {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index !== -1) stack.splice(index, 1);
  stack.push({ id, requestClose });
};

export const unregisterOverlay = (id: string) => {
  const index = stack.findIndex((entry) => entry.id === id);
  if (index !== -1) stack.splice(index, 1);
};

export const closeTopOverlay = (payload?: ClosePayload) => {
  const top = stack[stack.length - 1];
  if (top) top.requestClose(payload);
};

export const getActiveOverlayId = () => {
  const top = stack[stack.length - 1];
  return top ? top.id : null;
};

export const resetOverlayStack = () => {
  stack.length = 0;
};
