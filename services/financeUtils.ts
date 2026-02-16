export const formatCurrency = (val: number, minimumFractionDigits = 2) => {
  // Ensure maximumFractionDigits is at least equal to minimumFractionDigits to prevent RangeError.
  // We default max to 2, but if user requests more precision (e.g. 4 for NAV), we must increase max.
  const maximumFractionDigits = Math.max(2, minimumFractionDigits);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(val);
};

export const getSignColor = (val: number) => {
  if (val > 0) return 'text-stock-red';
  if (val < 0) return 'text-stock-green';
  return 'text-gray-500';
};

export const getBgColor = (val: number) => {
  if (val > 0) return 'bg-red-50';
  if (val < 0) return 'bg-green-50';
  return 'bg-gray-50';
};

export const formatPct = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
};

export const formatSignedCurrency = (val: number) => {
  const sign = val > 0 ? '+' : '';
  return `${sign}${formatCurrency(val)}`;
};