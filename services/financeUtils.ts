/**
 * Formats a number as a currency string.
 * @param val - The number to format.
 * @param minimumFractionDigits - The minimum number of fraction digits to use (default 2).
 * @returns The formatted currency string.
 */
export const formatCurrency = (val: number, minimumFractionDigits = 2) => {
  // Ensure maximumFractionDigits is at least equal to minimumFractionDigits to prevent RangeError.
  // We default max to 2, but if user requests more precision (e.g. 4 for NAV), we must increase max.
  const maximumFractionDigits = Math.max(2, minimumFractionDigits);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(val);
};

/**
 * Returns a Tailwind text color class based on the sign of the value.
 * Positive is red, negative is green.
 * @param val - The numeric value to evaluate.
 * @returns A Tailwind text color class string.
 */
export const getSignColor = (val: number) => {
  if (val > 0) return 'text-stock-red';
  if (val < 0) return 'text-stock-green';
  return 'text-gray-500';
};

/**
 * Returns a Tailwind background color class based on the sign of the value.
 * Positive is red-50, negative is green-50.
 * @param val - The numeric value to evaluate.
 * @returns A Tailwind background color class string.
 */
export const getBgColor = (val: number) => {
  if (val > 0) return 'bg-red-50';
  if (val < 0) return 'bg-green-50';
  return 'bg-gray-50';
};

/**
 * Formats a number as a percentage string with a sign and 2 decimal places.
 * @param val - The percentage value.
 * @returns The formatted percentage string.
 */
export const formatPct = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

/**
 * Formats a number as a signed currency string.
 * @param val - The numeric value.
 * @returns The formatted signed currency string.
 */
export const formatSignedCurrency = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${formatCurrency(val)}`;
};