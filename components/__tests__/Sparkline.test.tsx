import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '../Sparkline';

describe('Sparkline', () => {
  it('returns null when data has fewer than 2 points', () => {
    const { container } = render(<Sparkline data={[100]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('returns null for empty data array', () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders SVG with polyline for 3+ data points', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const polyline = svg!.querySelector('polyline');
    expect(polyline).not.toBeNull();
  });

  it('uses red color when first price < last price (upward trend)', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    const polyline = container.querySelector('polyline')!;
    expect(polyline.getAttribute('stroke')).toBe('#f87171');
  });

  it('uses green color when first price > last price (downward trend)', () => {
    const { container } = render(<Sparkline data={[102, 101, 100]} />);
    const polyline = container.querySelector('polyline')!;
    expect(polyline.getAttribute('stroke')).toBe('#34d399');
  });

  it('draws horizontal line when all prices are equal', () => {
    const { container } = render(<Sparkline data={[100, 100, 100]} />);
    const polyline = container.querySelector('polyline')!;
    expect(polyline).not.toBeNull();
    // Should not crash with NaN or Infinity
    const points = polyline.getAttribute('points');
    expect(points).not.toBeNull();
  });

  it('accepts explicit color override', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} color="#ff0000" />);
    const polyline = container.querySelector('polyline')!;
    expect(polyline.getAttribute('stroke')).toBe('#ff0000');
  });

  it('renders area fill polygon', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    const polygon = container.querySelector('polygon');
    expect(polygon).not.toBeNull();
  });

  it('respects custom width and height via viewBox', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} width={80} height={40} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 80 40');
  });

  it('uses default viewBox 0 0 60 36', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 60 36');
  });

  it('has responsive width with fixed height', () => {
    const { container } = render(<Sparkline data={[100, 101, 102]} />);
    const svg = container.querySelector('svg')!;
    const cls = svg.getAttribute('class') || '';
    expect(cls).toContain('w-full');
    expect(svg.getAttribute('height')).toBe('36');
  });
});
