import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';
import { useSettings } from '../services/SettingsContext';
import { recognizeHoldingsFromImage } from '../services/aiOcr';
import type { OcrHoldingItem } from '../services/aiOcr';
import { resolveAiRuntimeConfigByBusiness } from '../services/aiProviderConfig';
import { searchFunds, fetchFundCommonData } from '../services/api';
import { db } from '../services/db';
import type { Fund } from '../types';
import { resetDragState, useEdgeSwipe } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReviewItem = {
  id: string;
  name: string;
  amount?: number;
  dayGain?: number;
  holdingGain?: number;
  holdingGainPct?: number;
  codeHint?: string;
  matchedCode?: string;
  matchedName?: string;
  matched?: boolean;
  error?: string;
};

type ConflictDecision = 'keep' | 'overwrite';

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose }) => {
  const [scanning, setScanning] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [conflictMap, setConflictMap] = useState<Record<string, ConflictDecision>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastAutoValidateSignatureRef = useRef('');
  const overlayId = 'scanner-modal';
  const { isDragging, activeOverlayId, setDragState, snapBackX } = useEdgeSwipe();
  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const overlayOpen = isOpen || isReviewing;
  const translateX =
    isDragging && activeOverlayId === overlayId ? 'var(--edge-swipe-drag-x, 0px)' : '0px';
  const snapX = activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;
  const transition = closeTargetX !== null || snapX !== null ? 'transform 220ms ease' : 'none';

  const { t } = useTranslation();
  const settings = useSettings();
  const { provider, apiKey, model, baseURL } = resolveAiRuntimeConfigByBusiness(
    settings,
    'syncHoldings',
  );

  const [existingCodes, setExistingCodes] = useState<Set<string>>(new Set());

  const resetState = useCallback(() => {
    setScanning(false);
    setFile(null);
    setPreview('');
    setReviewItems([]);
    setIsReviewing(false);
    setConflictMap({});
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [onClose, resetState]);

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (payload?.targetX !== undefined) {
        setCloseTargetX(payload.targetX);
        return;
      }
      handleClose();
    },
    [handleClose],
  );

  useOverlayRegistration(overlayId, overlayOpen, requestClose);

  useEffect(() => {
    return () => {
      if (activeOverlayId === overlayId) {
        resetDragState(setDragState);
      }
    };
  }, [activeOverlayId, overlayId, setDragState]);

  const handleSelectFile = (f?: File | null) => {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    handleSelectFile(f);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        handleSelectFile(blob);
        e.preventDefault();
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleSelectFile(f);
  };

  const parseNumInput = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    const num = parseFloat(trimmed);
    return Number.isNaN(num) ? undefined : num;
  };

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    let mounted = true;
    db.funds.toArray().then((funds) => {
      if (!mounted) return;
      setExistingCodes(new Set(funds.map((f) => f.code)));
    });
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const openManualReview = () => {
    setReviewItems([
      {
        id: `${Date.now()}_manual`,
        name: '',
      },
    ]);
    setIsReviewing(true);
  };

  const getValidateSignature = (items: ReviewItem[]) =>
    items.map((item) => `${item.id}|${item.name.trim()}|${item.codeHint || ''}`).join('||');

  const handleApiKeyIssue = () => {
    const shouldOpen = confirm(t('common.aiKeyMissing') || '请先在设置里填写接口密钥');
    if (shouldOpen) {
      handleClose();
      window.dispatchEvent(new CustomEvent('open-ai-settings'));
    } else {
      openManualReview();
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    if (!apiKey) {
      handleApiKeyIssue();
      return;
    }

    setScanning(true);
    try {
      const result = await recognizeHoldingsFromImage({
        provider,
        apiKey,
        model,
        baseURL,
        file,
      });

      const mapped: ReviewItem[] = result.items.map((item: OcrHoldingItem, idx) => ({
        id: `${Date.now()}_${idx}`,
        name: item.name,
        amount: item.amount,
        dayGain: item.dayGain,
        holdingGain: item.holdingGain,
        holdingGainPct: item.holdingGainPct,
        codeHint: item.codeHint,
      }));

      if (mapped.length === 0) {
        alert(t('common.ocrEmpty') || '未识别到基金条目');
      }
      setReviewItems(mapped);
      setIsReviewing(true);
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message.toLowerCase()
          : String((err as { message?: string } | null)?.message || '').toLowerCase();
      if (
        message.includes('api key') ||
        message.includes('apikey') ||
        message.includes('unauthorized') ||
        message.includes('401') ||
        message.includes('invalid api key') ||
        message.includes('incorrect api key') ||
        message.includes('api_key_invalid')
      ) {
        handleApiKeyIssue();
      } else {
        alert(t('common.ocrFailed') || '识别失败，请稍后重试');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleValidate = useCallback(async () => {
    const updated = await Promise.all(
      reviewItems.map(async (item) => {
        if (!item.name) return { ...item, matched: false, error: 'empty name' };
        try {
          const data = await searchFunds(item.codeHint || item.name);
          const best = data?.data?.[0];
          if (!best) return { ...item, matched: false, error: 'not found' };
          return {
            ...item,
            matched: true,
            matchedCode: best.symbol,
            matchedName: best.fundNameArr || best.fundName,
          };
        } catch {
          return { ...item, matched: false, error: 'search failed' };
        }
      }),
    );

    setReviewItems(updated);
  }, [reviewItems]);

  useEffect(() => {
    if (!isReviewing || reviewItems.length === 0) return;

    const hasValidName = reviewItems.some((item) => item.name.trim());
    if (!hasValidName) return;

    const signature = getValidateSignature(reviewItems);
    if (signature === lastAutoValidateSignatureRef.current) return;

    const timer = setTimeout(() => {
      lastAutoValidateSignatureRef.current = signature;
      handleValidate();
    }, 250);

    return () => clearTimeout(timer);
  }, [handleValidate, isReviewing, reviewItems]);

  const updateReviewItem = (id: string, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const handleImport = async () => {
    const existingFunds = await db.funds.toArray();
    const existingMap = new Map(existingFunds.map((f) => [f.code, f]));
    const accounts = await db.accounts.toArray();
    const fallbackAccountName =
      accounts.find((acc) => acc.isDefault)?.name || accounts[0]?.name || 'Default';

    for (const item of reviewItems) {
      const code = item.matchedCode;
      const name = item.matchedName || item.name;
      if (!code) continue;

      const decision = conflictMap[code];
      const existing = existingMap.get(code);
      if (existing && !decision) {
        alert(t('common.pickConflict') || '请为重复基金选择保留或覆盖');
        return;
      }
      if (existing && decision === 'keep') continue;

      const navJson = await fetchFundCommonData(code);
      const currentNav = navJson?.data?.nav || 0;
      const navDate = navJson?.data?.navDate || getLocalDateString();
      const navChangePct = navJson?.data?.navChangePercent || 0;

      const amount = item.amount || 0;
      const shares = currentNav ? amount / currentNav : 0;
      const holdingGain = item.holdingGain ?? undefined;
      const totalCost = holdingGain !== undefined ? amount - holdingGain : amount;
      const costPrice = shares > 0 ? totalCost / shares : currentNav || 0;

      const mktVal = shares * currentNav;
      const dayChangeVal =
        item.dayGain ??
        (navChangePct ? (mktVal * (navChangePct / 100)) / (1 + navChangePct / 100) : 0);

      const payload: Fund = {
        code,
        name,
        platform: existing?.platform || fallbackAccountName,
        holdingShares: shares,
        costPrice,
        currentNav,
        lastUpdate: navDate,
        dayChangePct: navChangePct,
        dayChangeVal,
        buyDate: navDate,
        buyTime: 'before15',
        settlementDays: 1,
      };

      if (existing && decision === 'overwrite') {
        await db.funds.put({ ...payload, id: existing.id });
      } else if (!existing) {
        await db.funds.add(payload);
      }
    }

    alert(t('common.importSuccessShort') || '导入完成');
    handleClose();
  };

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onPaste={handlePaste}
            onClick={handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="w-full flex justify-center"
              style={{ transform: `translateX(${transformX})`, transition }}
              onTransitionEnd={() => {
                if (closeTargetX !== null) {
                  setCloseTargetX(null);
                  resetDragState(setDragState);
                  handleClose();
                  return;
                }
                if (snapX !== null) {
                  resetDragState(setDragState);
                }
              }}
            >
              <motion.div
                className="bg-white dark:bg-card-dark rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg overflow-hidden shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
                initial={isDesktop ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 1, y: 40 }}
                animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
                exit={isDesktop ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 1, y: 40 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              >
                <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">
                    {t('common.smartEntry')}
                  </h3>
                  <button onClick={handleClose}>
                    <Icons.Plus className="transform rotate-45 text-gray-400" />
                  </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto">
                  <div
                    className="w-full aspect-[3/4] bg-gray-50 dark:bg-white/5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center relative overflow-hidden"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    {preview ? (
                      <img
                        src={preview}
                        alt="preview"
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    ) : (
                      <>
                        <Icons.Scan size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                          {t('common.uploadTip')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                          {t('common.dragPasteTip') || '支持拖拽或粘贴图片'}
                        </p>
                      </>
                    )}
                    {scanning && (
                      <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 flex flex-col items-center justify-center">
                        <div className="text-blue-600 font-bold">{t('common.ocrProcessing')}</div>
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 px-2">{t('common.ocrPrivacy')}</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl font-bold"
                    >
                      {t('common.selectImage')}
                    </button>
                    <button
                      onClick={handleAnalyze}
                      disabled={!file || scanning}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-50"
                    >
                      {scanning ? t('common.analyzing') : t('common.startOcr')}
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isReviewing && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
            onClick={() => {
              setIsReviewing(false);
              lastAutoValidateSignatureRef.current = '';
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div
              className="w-full flex justify-center"
              style={{ transform: `translateX(${transformX})`, transition }}
              onTransitionEnd={() => {
                if (closeTargetX !== null) {
                  setCloseTargetX(null);
                  resetDragState(setDragState);
                  handleClose();
                  return;
                }
                if (snapX !== null) {
                  resetDragState(setDragState);
                }
              }}
            >
              <motion.div
                className="bg-white dark:bg-card-dark rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg overflow-hidden shadow-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
                initial={isDesktop ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 1, y: 40 }}
                animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
                exit={isDesktop ? { opacity: 0, scale: 0.95, y: 20 } : { opacity: 1, y: 40 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              >
                <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5">
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">
                    {t('common.ocrReview') || '识别结果确认'}
                  </h3>
                  <button
                    onClick={() => {
                      setIsReviewing(false);
                      lastAutoValidateSignatureRef.current = '';
                    }}
                  >
                    <Icons.Plus className="transform rotate-45 text-gray-400" />
                  </button>
                </div>
                <div className="p-6 space-y-3 overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <button onClick={handleValidate} className="text-xs text-blue-600 font-bold">
                      {t('common.validateFunds') || '重新验证'}
                    </button>
                  </div>

                  <div className="space-y-3">
                    {reviewItems.map((item) => {
                      const isConflict = item.matchedCode && existingCodes.has(item.matchedCode);
                      const decision = item.matchedCode ? conflictMap[item.matchedCode] : undefined;

                      return (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg border border-gray-100 dark:border-border-dark"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <input
                              value={item.name}
                              onChange={(e) => updateReviewItem(item.id, { name: e.target.value })}
                              className="flex-1 mr-2 px-2 py-1 border border-gray-200 dark:border-gray-700 rounded text-sm bg-white dark:bg-white/5"
                            />
                            <span
                              className={`text-[10px] ${item.matched ? 'text-green-600' : 'text-gray-400'}`}
                            >
                              {item.matched
                                ? t('common.matched') || '已匹配'
                                : t('common.unmatched') || '未匹配'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <input
                              value={item.amount ?? ''}
                              onChange={(e) =>
                                updateReviewItem(item.id, { amount: parseNumInput(e.target.value) })
                              }
                              placeholder={t('common.holdingAmount') || '持仓金额'}
                              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-white/5"
                            />
                            <input
                              value={item.dayGain ?? ''}
                              onChange={(e) =>
                                updateReviewItem(item.id, {
                                  dayGain: parseNumInput(e.target.value),
                                })
                              }
                              placeholder={t('common.dayGain') || '昨日收益'}
                              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-white/5"
                            />
                            <input
                              value={item.holdingGain ?? ''}
                              onChange={(e) =>
                                updateReviewItem(item.id, {
                                  holdingGain: parseNumInput(e.target.value),
                                })
                              }
                              placeholder={t('common.totalGain') || '持有收益'}
                              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-white/5"
                            />
                            <input
                              value={item.holdingGainPct ?? ''}
                              onChange={(e) =>
                                updateReviewItem(item.id, {
                                  holdingGainPct: parseNumInput(e.target.value),
                                })
                              }
                              placeholder={t('common.totalGainPct') || '持有收益率%'}
                              className="px-2 py-1 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-white/5"
                            />
                          </div>

                          {item.matchedName && (
                            <div className="text-[10px] text-gray-400 mt-2">
                              {item.matchedName} ({item.matchedCode})
                            </div>
                          )}

                          {isConflict && item.matchedCode && (
                            <div className="mt-2 flex gap-2 text-[10px]">
                              <button
                                onClick={() =>
                                  setConflictMap((prev) => ({
                                    ...prev,
                                    [item.matchedCode!]: 'keep',
                                  }))
                                }
                                className={`px-2 py-1 rounded ${decision === 'keep' ? 'bg-gray-200 dark:bg-white/10' : 'bg-gray-50 dark:bg-white/5'}`}
                              >
                                {t('common.keepExisting') || '保留已有'}
                              </button>
                              <button
                                onClick={() =>
                                  setConflictMap((prev) => ({
                                    ...prev,
                                    [item.matchedCode!]: 'overwrite',
                                  }))
                                }
                                className={`px-2 py-1 rounded ${decision === 'overwrite' ? 'bg-blue-600 text-white' : 'bg-gray-50 dark:bg-white/5'}`}
                              >
                                {t('common.overwrite') || '覆盖'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => {
                        setIsReviewing(false);
                        lastAutoValidateSignatureRef.current = '';
                      }}
                      className="flex-1 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl font-bold"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      onClick={handleImport}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-bold"
                    >
                      {t('common.confirmImport') || '确认导入'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
