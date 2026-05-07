interface SparklineProps {
  /** Array of price values in chronological order */
  data: number[];
  /** SVG viewport width in pixels (default 60) */
  width?: number;
  /** SVG viewport height in pixels (default 36) */
  height?: number;
  /** CSS color for the line. Defaults to red (up) or green (down) based on trend. */
  color?: string;
  /** Additional CSS classes for the SVG element */
  className?: string;
}

export const Sparkline = ({
  data,
  width = 60,
  height = 28,
  color,
  className,
}: SparklineProps): React.ReactElement | null => {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  const padding = 0;
  const drawWidth = width - padding * 2;
  const drawHeight = height - padding * 2;

  const points = data.map((price, i) => {
    const x = padding + (i / (data.length - 1)) * drawWidth;
    const y =
      range === 0
        ? padding + drawHeight / 2
        : padding + drawHeight - ((price - min) / range) * drawHeight;
    return `${x},${y}`;
  });

  const resolvedColor = color || (data[0] <= data[data.length - 1] ? '#f87171' : '#34d399');
  const fillColor = resolvedColor.replace(')', ',0.12)').replace('rgb', 'rgba');
  // Handle hex colors: #f87171 -> rgba(248,113,113,0.12)
  const hexToRgba = (hex: string, alpha: number): string => {
    const match = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
    if (!match) return fillColor; // fallback
    return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${alpha})`;
  };
  const areaFill = hexToRgba(resolvedColor, 0.12);

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      height={height}
      aria-hidden="true"
      className={`block flex-shrink-0 w-full ${className ?? ''}`}
    >
      <polygon points={areaPoints} fill={areaFill} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={resolvedColor}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};
