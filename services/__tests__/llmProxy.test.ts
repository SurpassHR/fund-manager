import { describe, expect, it } from 'vitest';
import { getLlmProxyBaseUrl } from '../llmProxy';

describe('getLlmProxyBaseUrl', () => {
  it('应返回绝对同源代理地址', () => {
    const url = getLlmProxyBaseUrl();
    expect(url.startsWith('http://') || url.startsWith('https://')).toBe(true);
    expect(url.endsWith('/llm-proxy')).toBe(true);
  });
});
