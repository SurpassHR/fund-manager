import React, { useRef, useEffect } from 'react';

interface GlowGridProps {
  className?: string;
  gridSize?: number;
  dotSize?: number;
  glowColor?: string;
  glowRadius?: number;
  baseDotColor?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export const GlowGrid: React.FC<GlowGridProps> = ({
  className = '',
  gridSize = 48,
  dotSize = 1.2,
  glowColor,
  glowRadius = 180,
  baseDotColor,
  'aria-hidden': ariaHidden,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const layer = layerRef.current;
    if (!container || !layer) return;

    let fadeTimer: ReturnType<typeof setTimeout>;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      layer.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      layer.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);

      // 鼠标移动时立即点亮，重置消散计时器
      layer.classList.add('glow-grid-active');
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => {
        layer.classList.remove('glow-grid-active');
      }, 1200);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(fadeTimer);
    };
  }, []);

  const cssVars: Record<string, string> = {
    '--grid-size': `${gridSize}px`,
    '--dot-size': `${dotSize}px`,
    '--glow-radius': `${glowRadius}px`,
  };
  if (glowColor) cssVars['--glow-color'] = glowColor;
  if (baseDotColor) cssVars['--base-dot-color'] = baseDotColor;

  return (
    <div
      ref={containerRef}
      className={`glow-grid-container ${className}`}
      style={cssVars}
      aria-hidden={ariaHidden}
    >
      <div
        ref={layerRef}
        className="glow-grid-layer pointer-events-none absolute inset-0"
        style={{ '--mouse-x': '-100%', '--mouse-y': '-100%' } as React.CSSProperties}
      />
    </div>
  );
};
