const roundBy = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isWeekday = (date: Date) => {
  const d = date.getDay();
  return d >= 1 && d <= 5;
};

const toDate = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const moveToNextTradingDay = (date: Date, isTradingDay?: (d: Date) => boolean) => {
  const checkTradingDay = isTradingDay || isWeekday;
  while (!checkTradingDay(date)) {
    date.setDate(date.getDate() + 1);
  }
};

export const getEffectiveOperationDate = (
  opDateStr: string,
  opTime: 'before15' | 'after15',
  isTradingDay?: (date: Date) => boolean,
) => {
  const d = toDate(opDateStr);

  moveToNextTradingDay(d, isTradingDay);

  if (opTime === 'after15') {
    d.setDate(d.getDate() + 1);
    moveToNextTradingDay(d, isTradingDay);
  }

  return formatLocalDate(d);
};

export const roundMoney = (value: number) => roundBy(value, 6);
export const roundShares = (value: number) => roundBy(value, 6);
