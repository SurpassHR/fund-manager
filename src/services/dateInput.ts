const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value: number): string => value.toString().padStart(2, '0');

const formatLocalDate = (date: Date): string => {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

export const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;

  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

export const shiftIsoDateByDays = (value: string, deltaDays: number): string | null => {
  if (!isValidIsoDate(value)) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  date.setDate(date.getDate() + deltaDays);
  return formatLocalDate(date);
};
