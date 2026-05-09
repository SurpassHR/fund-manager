import '@testing-library/jest-dom/vitest';

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  }),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// 保留 jsdom 原有的 RAF（framer-motion 依赖 RAF 回调），仅确保 cancelAnimationFrame 可用
if (!global.cancelAnimationFrame) {
  global.cancelAnimationFrame = () => {};
}

// Canvas 2D context
const origGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (
  this: HTMLCanvasElement,
  contextType: string,
  ...args: unknown[]
) {
  if (contextType === '2d') {
    return {
      scale: () => undefined,
      setTransform: () => undefined,
      clearRect: () => undefined,
      fillRect: () => undefined,
      strokeRect: () => undefined,
      beginPath: () => undefined,
      closePath: () => undefined,
      fill: () => undefined,
      stroke: () => undefined,
      roundRect: () => undefined,
      arc: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      quadraticCurveTo: () => undefined,
      canvas: { width: 0, height: 0 },
    } as unknown as CanvasRenderingContext2D;
  }
  return origGetContext.call(this, contextType, ...args);
} as typeof HTMLCanvasElement.prototype.getContext;
