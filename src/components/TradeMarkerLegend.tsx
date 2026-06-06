import { TRADE_MARKER_COLORS } from './fundDetailChartUtils';

export const TradeMarkerLegend = ({
  mode,
  labels,
}: {
  mode: 'holding' | 'watchlist';
  labels: { buy: string; sell: string; liquidation: string; anchor: string };
}) => {
  if (mode === 'watchlist') {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1">
          <span
            data-testid="legend-dot-anchor"
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: TRADE_MARKER_COLORS.anchor }}
          />
          {labels.anchor}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
      <span className="inline-flex items-center gap-1">
        <span
          data-testid="legend-dot-buy"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TRADE_MARKER_COLORS.buy }}
        />
        {labels.buy}
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          data-testid="legend-dot-sell"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TRADE_MARKER_COLORS.sell }}
        />
        {labels.sell}
      </span>
      <span className="inline-flex items-center gap-1">
        <span
          data-testid="legend-dot-liquidation"
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: TRADE_MARKER_COLORS.liquidation }}
        />
        {labels.liquidation}
      </span>
    </div>
  );
};
