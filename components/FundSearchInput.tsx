import React, { useCallback, useEffect, useRef, useState } from 'react';
import { searchFunds } from '../services/api';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import type { MorningstarFund } from '../types';

interface FundSearchInputProps {
  /** 选中基金回调 */
  onSelect: (fund: MorningstarFund) => void;
  /** 外部可选的搜索词覆盖（用于 reset） */
  externalQuery?: string;
  /** 搜索框 placeholder */
  placeholder?: string;
  /** 自定义类名 */
  className?: string;
}

export const FundSearchInput: React.FC<FundSearchInputProps> = ({
  onSelect,
  externalQuery,
  placeholder,
  className = '',
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MorningstarFund[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (externalQuery !== undefined) {
      setQuery(externalQuery);
      setResults([]);
      setError('');
    }
  }, [externalQuery]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError('');

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchFunds(query.trim());
        if (res?.data) {
          setResults(res.data);
        } else {
          setResults([]);
          setError('搜索失败，请检查网络或稍后重试');
        }
      } catch {
        setError('搜索失败，请检查网络或稍后重试');
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = useCallback(
    (fund: MorningstarFund) => {
      setQuery('');
      setResults([]);
      onSelect(fund);
    },
    [onSelect],
  );

  return (
    <div className={`flex flex-col ${className}`}>
      {/* 搜索框 */}
      <div className="relative">
        <Icons.Search
          size={18}
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${isSearching ? 'text-blue-500' : 'text-[var(--app-shell-muted)]'}`}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || t('common.searchFund')}
          className="w-full pl-10 pr-4 py-3 border border-[var(--app-shell-line)] rounded-xl bg-[var(--app-shell-panel)] focus:bg-[var(--app-shell-paper)] dark:focus:bg-[var(--app-shell-paper-dark)] focus:border-blue-500 focus:outline-none transition-all text-[var(--app-shell-ink)] placeholder:text-[var(--app-shell-muted)] text-sm"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Icons.Settings size={16} className="text-blue-500 animate-spin" />
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {/* 搜索结果列表 */}
      {results.length > 0 && (
        <div className="mt-2 border border-[var(--app-shell-line)] rounded-xl overflow-hidden bg-[var(--app-shell-paper)] dark:bg-[var(--app-shell-paper-dark)]">
          {results.map((fund, idx) => (
            <div
              key={fund.fundClassId}
              onClick={() => handleSelect(fund)}
              className={`px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors flex items-center justify-between ${idx < results.length - 1 ? 'border-b border-[var(--app-shell-line)]' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--app-shell-ink)] truncate pr-2">
                  {fund.fundNameArr || fund.fundName}
                </div>
                <div className="text-xs text-[var(--app-shell-muted)] mt-0.5 flex gap-2">
                  <span>{fund.symbol}</span>
                  {fund.fundType && <span>· {fund.fundType}</span>}
                </div>
              </div>
              <Icons.Plus size={16} className="text-blue-500 shrink-0 ml-1" />
            </div>
          ))}
        </div>
      )}

      {/* 空搜索提示 */}
      {!isSearching && query.trim().length >= 2 && results.length === 0 && !error && (
        <div className="text-center py-8 text-[var(--app-shell-muted)] text-sm">
          {t('common.noResults')}
        </div>
      )}
    </div>
  );
};
