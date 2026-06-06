import type { MorningstarFund } from '../types';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sanitizeWatchlistName = (name: string, code?: string) => {
  const trimmed = name.trim();
  if (!trimmed || !code) return trimmed;

  const escapedCode = escapeRegExp(code.trim());
  const leadingCodePattern = new RegExp(`^${escapedCode}[\\s-_：:]*`);
  const normalized = trimmed.replace(leadingCodePattern, '').trim();
  return normalized || trimmed;
};

export const pickWatchlistNameFromMorningstar = (fund: MorningstarFund) => {
  const preferred = fund.fundNameArr?.trim() || fund.fundName;
  return sanitizeWatchlistName(preferred, fund.symbol);
};
