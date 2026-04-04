export const getLlmProxyBaseUrl = () => {
  const origin =
    typeof window !== 'undefined' && typeof window.location?.origin === 'string'
      ? window.location.origin
      : 'http://localhost';
  return `${origin.replace(/\/+$/, '')}/llm-proxy`;
};
