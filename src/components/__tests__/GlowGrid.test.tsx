/// <reference types="vitest/globals" />
import React from 'react';
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';

import { GlowGrid } from '../GlowGrid';

describe('GlowGrid', () => {
  it('渲染 bg-blobs 和 bg-grid-pattern', () => {
    const { container } = render(<GlowGrid />);

    const blobsContainer = container.querySelector('.bg-blobs');
    const gridPattern = container.querySelector('.bg-grid-pattern');

    expect(blobsContainer).toBeInTheDocument();
    expect(gridPattern).toBeInTheDocument();
    
    // 确认有三个 blob
    expect(blobsContainer?.querySelectorAll('.blob').length).toBe(3);
  });

  it('应用传入的 className 和 aria-hidden 属性', () => {
    const { container } = render(<GlowGrid className="custom-test-class" aria-hidden="true" />);

    const rootElement = container.firstChild as HTMLElement;
    
    expect(rootElement.classList.contains('custom-test-class')).toBe(true);
    expect(rootElement.getAttribute('aria-hidden')).toBe('true');
  });
});
