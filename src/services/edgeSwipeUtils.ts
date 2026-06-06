type Params = {
  edge: 'left' | 'right';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  screenWidth: number;
};

export type SwipeProgress = {
  isValid: boolean;
  dragX: number;
  shouldClose: boolean;
};

export const computeSwipeProgress = (params: Params): SwipeProgress => {
  const { edge, startX, startY, currentX, currentY, screenWidth } = params;
  const dx = currentX - startX;
  const dy = currentY - startY;

  const inward = edge === 'left' ? dx > 0 : dx < 0;
  const horizontal = Math.abs(dx) > 2 * Math.abs(dy);
  const isValid = inward && horizontal;

  const dragX = Math.max(-screenWidth, Math.min(screenWidth, dx));
  const shouldClose = isValid && Math.abs(dx) >= 0.5 * screenWidth;

  return { isValid, dragX, shouldClose };
};
