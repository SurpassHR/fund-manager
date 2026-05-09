/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { GlowGrid } from '../GlowGrid';

describe('GlowGrid', () => {
  it('渲染容器和发光层', () => {
    const { container } = render(<GlowGrid />);

    const gridContainer = container.querySelector('.glow-grid-container');
    const layer = container.querySelector('.glow-grid-layer');

    expect(gridContainer).toBeInTheDocument();
    expect(layer).toBeInTheDocument();
  });

  it('默认 CSS 变量初始值为 -100%，鼠标进入前不显示发光', () => {
    const { container } = render(<GlowGrid />);

    const layer = container.querySelector('.glow-grid-layer') as HTMLElement;
    expect(layer).toBeInTheDocument();

    // 初始值设为 -100% 以隐藏发光圆（内联 + CSS 双重保障）
    expect(layer.style.getPropertyValue('--mouse-x')).toBe('-100%');
    expect(layer.style.getPropertyValue('--mouse-y')).toBe('-100%');
  });

  it('鼠标移动时更新 --mouse-x / --mouse-y 并添加激活类', () => {
    const { container } = render(<GlowGrid />);

    const gridContainer = container.querySelector('.glow-grid-container') as HTMLElement;
    const layer = container.querySelector('.glow-grid-layer') as HTMLElement;

    // Mock getBoundingClientRect
    const rectMock = { left: 50, top: 100, right: 850, bottom: 600, width: 800, height: 500 };
    vi.spyOn(gridContainer, 'getBoundingClientRect').mockReturnValue(rectMock as DOMRect);

    // 初始无激活类
    expect(layer.classList.contains('glow-grid-active')).toBe(false);

    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 300 }));

    expect(layer.style.getPropertyValue('--mouse-x')).toBe('150px'); // 200 - 50
    expect(layer.style.getPropertyValue('--mouse-y')).toBe('200px'); // 300 - 100
    expect(layer.classList.contains('glow-grid-active')).toBe(true);
  });

  it('接受自定义参数并应用到 CSS 变量', () => {
    const { container } = render(
      <GlowGrid
        gridSize={60}
        dotSize={2}
        glowColor="#ff0000"
        glowRadius={200}
        baseDotColor="rgba(0,0,0,0.5)"
      />,
    );

    const gridContainer = container.querySelector('.glow-grid-container') as HTMLElement;

    expect(gridContainer.style.getPropertyValue('--grid-size')).toBe('60px');
    expect(gridContainer.style.getPropertyValue('--dot-size')).toBe('2px');
    expect(gridContainer.style.getPropertyValue('--glow-color')).toBe('#ff0000');
    expect(gridContainer.style.getPropertyValue('--glow-radius')).toBe('200px');
    expect(gridContainer.style.getPropertyValue('--base-dot-color')).toBe('rgba(0,0,0,0.5)');
  });
});
