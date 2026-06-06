import React from 'react';

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
  'aria-hidden': ariaHidden,
}) => {
  return (
    <div
      className={`fixed inset-0 z-0 pointer-events-none overflow-hidden ${className}`}
      aria-hidden={ariaHidden}
    >
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>
      <div className="bg-grid-pattern"></div>
    </div>
  );
};
