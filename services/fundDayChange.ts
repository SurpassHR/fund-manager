export type FundTradeTime = 'before15' | 'after15';

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Calculates the settlement date for a transaction (T+N days).
 * Skips weekends and treats after 15:00 as the next trading day.
 */
export const getSettlementDate = (
  opDateStr: string,
  opTime: FundTradeTime,
  tPlusN: number,
): string => {
  const date = new Date(opDateStr);

  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  else if (date.getDay() === 6) date.setDate(date.getDate() + 2);

  if (opTime === 'after15') {
    date.setDate(date.getDate() + 1);
    if (date.getDay() === 6) date.setDate(date.getDate() + 2);
    else if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  }

  let remaining = tPlusN;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      remaining--;
    }
  }

  return formatDate(date);
};

export const deriveFundGainActivationState = (params: {
  buyDate?: string;
  buyTime?: FundTradeTime;
  settlementDays?: number;
  effectivePctDate: string;
  costPrice?: number;
}) => {
  const { buyDate, buyTime = 'before15', settlementDays = 1, effectivePctDate, costPrice } = params;

  if (!buyDate) {
    return {
      isGainActive: true,
      dayChangeBaseNav: undefined as number | undefined,
    };
  }

  const settlementDate = getSettlementDate(buyDate, buyTime, settlementDays);
  if (effectivePctDate < settlementDate) {
    return {
      isGainActive: false,
      dayChangeBaseNav: undefined as number | undefined,
    };
  }

  if (costPrice !== undefined && effectivePctDate === settlementDate) {
    return {
      isGainActive: true,
      dayChangeBaseNav: costPrice,
    };
  }

  return {
    isGainActive: true,
    dayChangeBaseNav: undefined as number | undefined,
  };
};

export const deriveFundHoldingDisplayMetrics = (params: {
  holdingShares: number;
  currentNav: number;
  costPrice: number;
  buyDate?: string;
  buyTime?: FundTradeTime;
  settlementDays?: number;
  effectiveDate: string;
}) => {
  const {
    holdingShares,
    currentNav,
    costPrice,
    buyDate,
    buyTime,
    settlementDays,
    effectiveDate,
  } = params;

  const marketValue = holdingShares * currentNav;
  const totalCost = holdingShares * costPrice;
  const activationState = deriveFundGainActivationState({
    buyDate,
    buyTime,
    settlementDays,
    effectivePctDate: effectiveDate,
    costPrice,
  });

  const totalGain = activationState.isGainActive ? marketValue - totalCost : 0;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return {
    marketValue,
    totalCost,
    totalGain,
    totalGainPct,
    isInTransit: !activationState.isGainActive,
    dayChangeBaseNav: activationState.dayChangeBaseNav,
  };
};

export const deriveFundIntradayDisplayMetrics = (params: {
  holdingShares: number;
  nav: number;
  navDate: string;
  todayStr: string;
  navChangePercent: number;
  officialPreviousNav?: number;
  shouldEstimate: boolean;
  estimatedChangePct?: number;
  isGainActive: boolean;
  dayChangeBaseNav?: number;
}) => {
  const {
    holdingShares,
    nav,
    navDate,
    todayStr,
    navChangePercent,
    officialPreviousNav,
    shouldEstimate,
    estimatedChangePct,
    isGainActive,
    dayChangeBaseNav,
  } = params;

  const hasOfficialTodayNav = navDate === todayStr;
  const shouldTryEstimate = shouldEstimate && !hasOfficialTodayNav;
  const hasEstimate = shouldTryEstimate && estimatedChangePct !== undefined;
  const todayChangeUnavailable = shouldTryEstimate && !hasEstimate;
  const effectivePctDate = shouldTryEstimate ? todayStr : navDate;

  const dayChangePct = !isGainActive
    ? 0
    : hasEstimate
      ? (estimatedChangePct as number)
      : todayChangeUnavailable
        ? 0
        : navChangePercent;

  let dayChangeVal = 0;
  if (isGainActive) {
    const currentEffectiveNav = hasEstimate ? nav * (1 + (estimatedChangePct as number) / 100) : nav;

    if (dayChangeBaseNav !== undefined) {
      dayChangeVal = holdingShares * (currentEffectiveNav - dayChangeBaseNav);
    } else if (hasEstimate) {
      const marketValue = holdingShares * nav;
      dayChangeVal = marketValue * ((estimatedChangePct as number) / 100);
    } else if (!todayChangeUnavailable) {
      if (officialPreviousNav !== undefined) {
        dayChangeVal = holdingShares * (nav - officialPreviousNav);
      } else {
        const marketValue = holdingShares * nav;
        dayChangeVal = (marketValue * (navChangePercent / 100)) / (1 + navChangePercent / 100);
      }
    }
  }

  return {
    effectivePctDate,
    dayChangePct,
    dayChangeVal,
    officialDayChangePct: navChangePercent,
    estimatedDayChangePct: hasEstimate ? (estimatedChangePct as number) : 0,
    todayChangeIsEstimated: hasEstimate,
    todayChangeUnavailable,
  };
};
