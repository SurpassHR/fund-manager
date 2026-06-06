type Point = {
  x: number;
  y: number;
};

export const hasTouchMovedBeyondThreshold = (
  startPoint: Point,
  currentPoint: Point,
  thresholdPx: number,
): boolean => {
  const dx = Math.abs(currentPoint.x - startPoint.x);
  const dy = Math.abs(currentPoint.y - startPoint.y);
  return dx > thresholdPx || dy > thresholdPx;
};
