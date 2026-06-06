type ParsedSellKind = 'shares' | 'percent' | 'fraction' | null;

type ParsedSellResult = {
  shares: number | null;
  kind: ParsedSellKind;
  error?: 'invalid';
};

const parseNumber = (value: string): number | null => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num;
};

export const parseSellInputToShares = (input: string, holdingShares: number): ParsedSellResult => {
  const normalized = input.trim();
  if (!normalized) return { shares: null, kind: null };

  if (normalized.endsWith('%')) {
    const pctStr = normalized.slice(0, -1).trim();
    const pct = parseNumber(pctStr);
    if (pct == null || pct <= 0) return { shares: null, kind: 'percent', error: 'invalid' };
    return {
      shares: (holdingShares * pct) / 100,
      kind: 'percent',
    };
  }

  if (normalized.includes('/')) {
    const [numStr, denStr, extra] = normalized.split('/');
    if (extra !== undefined) return { shares: null, kind: 'fraction', error: 'invalid' };
    const numerator = parseNumber(numStr.trim());
    const denominator = parseNumber(denStr.trim());
    if (numerator == null || denominator == null || numerator <= 0 || denominator <= 0) {
      return { shares: null, kind: 'fraction', error: 'invalid' };
    }
    return {
      shares: (holdingShares * numerator) / denominator,
      kind: 'fraction',
    };
  }

  const shares = parseNumber(normalized);
  if (shares == null || shares <= 0) return { shares: null, kind: 'shares', error: 'invalid' };

  return {
    shares,
    kind: 'shares',
  };
};
