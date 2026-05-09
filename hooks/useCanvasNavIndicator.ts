import { useRef, useLayoutEffect, useEffect, useCallback } from 'react';

interface UseCanvasNavIndicatorOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  activeIndex: number;
  itemCount: number;
  lerp: number;
  fillColor: string;
  borderColor: string;
  insetX: number;
  insetY: number;
  borderRadius: number;
}

interface CellGeometry {
  cellWidth: number;
  cellHeight: number;
  cellLeft: number;
  cellTop: number;
}

function resolveColor(el: HTMLElement, cssVar: string): string {
  if (!cssVar.startsWith('var(')) return cssVar;
  const name = cssVar.slice(4, -1).trim();
  return getComputedStyle(el).getPropertyValue(name).trim() || 'rgba(0,0,0,0.1)';
}

/** 读取容器 computed style，计算指定 index 的 grid cell 位置与尺寸 */
function calcCellGeometry(container: HTMLElement, index: number, itemCount: number): CellGeometry {
  const style = getComputedStyle(container);
  const padLeft = parseFloat(style.paddingLeft) || 0;
  const padRight = parseFloat(style.paddingRight) || 0;
  const padTop = parseFloat(style.paddingTop) || 0;
  const padBottom = parseFloat(style.paddingBottom) || 0;
  const gap = parseFloat(style.columnGap || style.gap) || 0;

  const rect = container.getBoundingClientRect();
  const containerW = rect.width;
  const containerH = rect.height;

  const availableW = containerW - padLeft - padRight;
  const totalGap = (itemCount - 1) * gap;
  const cellWidth = (availableW - totalGap) / itemCount;
  const cellLeft = padLeft + index * (cellWidth + gap);

  const cellHeight = containerH - padTop - padBottom;
  const cellTop = padTop;

  return { cellWidth, cellHeight, cellLeft, cellTop };
}

export function useCanvasNavIndicator({
  containerRef,
  activeIndex,
  itemCount,
  lerp,
  fillColor,
  borderColor,
  insetX,
  insetY,
  borderRadius,
}: UseCanvasNavIndicatorOptions): React.RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafId = useRef(0);
  const currentX = useRef(0);
  const currentW = useRef(0);
  const currentY = useRef(0);
  const currentH = useRef(0);
  const resolvedFill = useRef('rgba(0,0,0,0.1)');
  const resolvedBorder = useRef('rgba(0,0,0,0.1)');
  const dpr = useRef(window.devicePixelRatio || 1);
  const targetX = useRef(0);
  const targetW = useRef(0);

  const resolveColors = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    resolvedFill.current = resolveColor(container, fillColor);
    resolvedBorder.current = resolveColor(container, borderColor);
  }, [containerRef, fillColor, borderColor]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    dpr.current = window.devicePixelRatio || 1;

    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = w * dpr.current;
    canvas.height = h * dpr.current;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr.current, 0, 0, dpr.current, 0, 0);
    }
    resolveColors();
  }, [containerRef, resolveColors]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width / dpr.current;
    const h = canvas.height / dpr.current;
    const x = currentX.current;
    const y = currentY.current;
    const iw = currentW.current;
    const ih = currentH.current;
    const r = borderRadius;

    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + iw - r, y);
    ctx.quadraticCurveTo(x + iw, y, x + iw, y + r);
    ctx.lineTo(x + iw, y + ih - r);
    ctx.quadraticCurveTo(x + iw, y + ih, x + iw - r, y + ih);
    ctx.lineTo(x + r, y + ih);
    ctx.quadraticCurveTo(x, y + ih, x, y + ih - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = resolvedFill.current;
    ctx.fill();
    ctx.strokeStyle = resolvedBorder.current;
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [borderRadius]);

  const updateTarget = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const geo = calcCellGeometry(container, activeIndex, itemCount);

    targetX.current = geo.cellLeft + insetX;
    targetW.current = geo.cellWidth - insetX * 2;
    // 垂直方向不随 tab 切换变化，无需 lerp
    currentY.current = geo.cellTop + insetY;
    currentH.current = geo.cellHeight - insetY * 2;

    if (currentW.current === 0) {
      currentX.current = targetX.current;
      currentW.current = targetW.current;
    }

    if (lerp >= 1) {
      currentX.current = targetX.current;
      currentW.current = targetW.current;
      draw();
    }
  }, [activeIndex, itemCount, insetX, insetY, lerp, draw, containerRef]);

  // 初始化 Canvas 尺寸 & 监听 resize / 主题变化
  useLayoutEffect(() => {
    setupCanvas();
    updateTarget();

    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(() => {
      setupCanvas();
      updateTarget();
      draw();
    });
    ro.observe(container);

    const mo = new MutationObserver(() => {
      resolveColors();
      draw();
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [setupCanvas, updateTarget, draw, containerRef, resolveColors]);

  // 更新目标位置（activeIndex 变化时）
  useEffect(() => {
    updateTarget();
  }, [updateTarget]);

  // RAF 循环 — 收敛后自动停止，activeIndex 变化时 effect 重启
  useLayoutEffect(() => {
    if (lerp >= 1) return;
    if (typeof requestAnimationFrame !== 'function') {
      updateTarget();
      return;
    }

    let prevDrawX = currentX.current;
    let prevDrawW = currentW.current;

    const animate = () => {
      const container = containerRef.current;
      if (!container) {
        rafId.current = requestAnimationFrame(animate);
        return;
      }

      const tx = targetX.current;
      const tw = targetW.current;

      const prevX = currentX.current;
      const prevW = currentW.current;
      currentX.current += (tx - currentX.current) * lerp;
      currentW.current += (tw - currentW.current) * lerp;

      const dx = Math.abs(currentX.current - prevX);
      const dw = Math.abs(currentW.current - prevW);
      const distX = Math.abs(tx - currentX.current);
      const distW = Math.abs(tw - currentW.current);

      if (
        dx > 0.005 ||
        dw > 0.005 ||
        distX > 0.1 ||
        distW > 0.1 ||
        currentX.current !== prevDrawX ||
        currentW.current !== prevDrawW
      ) {
        draw();
        prevDrawX = currentX.current;
        prevDrawW = currentW.current;
        rafId.current = requestAnimationFrame(animate);
      }
    };

    rafId.current = requestAnimationFrame(animate);

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [lerp, draw, containerRef, updateTarget]);

  return canvasRef;
}
