# Trade Markers Legend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fund detail chart markers with red/blue/yellow dots and add a legend above the chart for holdings and watchlist views.

**Architecture:** Keep the existing ECharts setup in `FundDetail.tsx` and adjust only the `markPoint` construction and nearby UI. Add small helpers (`buildTradeMarkers`, `buildFundSeries`, `buildChartOption`, `getTradeLegendLabels`, `buildLegendViewModel`) for testable logic. Determine liquidation markers only when they can be inferred from the transaction sequence using available share deltas (sell amounts are shares; buy amounts are currency and cannot be converted reliably).

**Tech Stack:** React 19, TypeScript, ECharts, Tailwind CSS

---

## File Structure

- Modify: `components/FundDetail.tsx` (chart marker logic + legend UI + helpers)
- Modify: `services/i18n.tsx` (legend labels in `common`)
- Create: `components/FundDetail.test.tsx` (unit tests for helpers)

## Chunk 1: Chart Marker Logic

### Task 1: Trade marker helper + chart wiring

**Files:**

- Modify: `components/FundDetail.tsx`
- Create: `components/FundDetail.test.tsx`

- [ ] **Write failing test: buy marker**

```ts
import { expect, it } from 'vitest';
import { buildTradeMarkers } from './FundDetail';

it('marks buy with red dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-01'],
    fundData: [1],
    isWatchlist: false,
    buyDate: '2026-03-01',
    anchorDate: undefined,
    pendingTransactions: [],
    holdingShares: 10,
  });

  expect(markers.some((m) => m.name === 'buy' && m.itemStyle?.color === '#f87171')).toBe(true);
});
```

- [ ] **Run test: expect FAIL (helper missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement helper skeleton**

- Export `buildTradeMarkers` with params: `dates`, `fundData`, `isWatchlist`, `buyDate`, `anchorDate`, `pendingTransactions`, `holdingShares`.
- Return empty array initially.

- [ ] **Run test: expect FAIL (no buy marker)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement buy marker rule**

- Buy date -> red dot.
- Use colors: buy `#f87171`, sell/anchor `#3b82f6`, liquidation `#fbbf24`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: sell marker**

```ts
it('marks sell with blue dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-02'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-02',
        time: 'before15',
        amount: 10,
        settlementDate: '2026-03-03',
        settled: false,
      },
    ],
    holdingShares: 10,
  });

  expect(markers.some((m) => m.name === 'sell' && m.itemStyle?.color === '#3b82f6')).toBe(true);
});
```

- [ ] **Run test: expect FAIL (no sell marker)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement sell marker rule**

- Pending transactions of type `sell` -> blue dot.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: watchlist anchor marker**

```ts
it('marks watchlist anchor with blue dot', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-05'],
    fundData: [1],
    isWatchlist: true,
    buyDate: undefined,
    anchorDate: '2026-03-05',
    pendingTransactions: [],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'anchor' && m.itemStyle?.color === '#3b82f6')).toBe(true);
});
```

- [ ] **Run test: expect FAIL (no anchor marker)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement watchlist-only branch**

- If `isWatchlist` is true, return only the anchor marker (no buy/sell/liquidation markers).

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: watchlist excludes buy/sell/liquidation**

```ts
it('does not include buy/sell/liquidation markers on watchlist', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-05'],
    fundData: [1],
    isWatchlist: true,
    buyDate: '2026-03-05',
    anchorDate: '2026-03-05',
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-05',
        time: 'before15',
        amount: 1,
        settlementDate: '2026-03-06',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'buy')).toBe(false);
  expect(markers.some((m) => m.name === 'sell')).toBe(false);
  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
  expect(markers.some((m) => m.name === 'anchor')).toBe(true);
});
```

- [ ] **Run test: expect FAIL (extra markers present)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Enforce watchlist-only return**

- Return early for watchlist mode.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: marker defaults for all types**

```ts
it('uses circle markers for all marker types', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-01'],
    fundData: [1],
    isWatchlist: false,
    buyDate: '2026-03-01',
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-01',
        time: 'before15',
        amount: 1,
        settlementDate: '2026-03-02',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.every((m) => m.symbol === 'circle')).toBe(true);
  expect(markers.every((m) => m.label?.show === false)).toBe(true);
  expect(markers.every((m) => m.symbolSize === 8)).toBe(true);
});
```

- [ ] **Run test: expect FAIL (defaults missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement marker defaults**

- Ensure buy/sell/liquidation/anchor all set `symbol: 'circle'`, `symbolSize: 8`, `label: { show: false }`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: liquidation positive case**

```ts
it('marks liquidation when shares drop to zero', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03', '2026-03-04'],
    fundData: [1, 1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-04',
        settled: false,
      },
      {
        id: '2',
        type: 'sell',
        date: '2026-03-04',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-05',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'liquidation' && m.coord?.[0] === '2026-03-04')).toBe(true);
});
```

- [ ] **Run test: expect FAIL (no liquidation logic)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement liquidation inference: sort sells**

- Sort sell transactions by date + time.

- [ ] **Run test: expect FAIL (still missing liquidation)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement liquidation inference: initial shares**

- Infer initial shares as `holdingShares + sum(sell.amount)` (sell amount is shares).

- [ ] **Run test: expect FAIL (still missing liquidation)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement liquidation inference: walk and capture**

- Walk sells in chronological order; when running shares hits 0, capture that sell date.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: holdingShares guard**

```ts
it('does not mark liquidation when holdingShares is not zero', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-04',
        settled: false,
      },
    ],
    holdingShares: 5,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});
```

- [ ] **Run test: expect FAIL (still marking liquidation)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement holdingShares guard**

- Require `holdingShares === 0` before any liquidation inference runs.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: liquidation date validation**

```ts
it('does not mark liquidation when date not in chart', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'sell',
        date: '2026-03-04',
        time: 'before15',
        amount: 5,
        settlementDate: '2026-03-05',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});
```

- [ ] **Run test: expect FAIL (still marking liquidation)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement liquidation date validation**

- Only mark if the captured sell date exists in `dates`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: liquidation negative case (buy present)**

```ts
it('does not mark liquidation when buy transactions exist', () => {
  const markers = buildTradeMarkers({
    dates: ['2026-03-03'],
    fundData: [1],
    isWatchlist: false,
    buyDate: undefined,
    anchorDate: undefined,
    pendingTransactions: [
      {
        id: '1',
        type: 'buy',
        date: '2026-03-02',
        time: 'before15',
        amount: 100,
        settlementDate: '2026-03-03',
        settled: false,
      },
      {
        id: '2',
        type: 'sell',
        date: '2026-03-03',
        time: 'before15',
        amount: 10,
        settlementDate: '2026-03-04',
        settled: false,
      },
    ],
    holdingShares: 0,
  });

  expect(markers.some((m) => m.name === 'liquidation')).toBe(false);
});
```

- [ ] **Run test: expect FAIL (still marking liquidation)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement buy-sequence guard**

- Document in code: buy transactions store currency amounts (not shares), so mixed buy/sell sequences cannot be reliably inferred.
- Do not emit yellow dots when any buy transaction exists.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: series markPoint wiring**

```ts
import { buildFundSeries } from './FundDetail';

it('wires markers into markPoint', () => {
  const series = buildFundSeries({
    name: 'Test Fund',
    data: [1],
    markers: [{ name: 'buy', coord: ['2026-03-01', 1] }],
    isLargeSeries: false,
    color: '#f87171',
    anchorDate: undefined,
  });

  expect(series.markPoint?.data).toHaveLength(1);
});
```

- [ ] **Run test: expect FAIL (helper missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement series helper**

- Create `buildFundSeries` to return the fund series with `markPoint` populated.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: chart option wiring**

```ts
import { buildChartOption } from './FundDetail';

it('uses markers in chart option series', () => {
  const option = buildChartOption({
    fundName: 'Test Fund',
    fundData: [1],
    markers: [{ name: 'buy', coord: ['2026-03-01', 1] }],
    isLargeSeries: false,
    color: '#f87171',
    anchorDate: undefined,
  });

  const fundSeries = option.series?.[0];
  expect(fundSeries?.markPoint?.data).toHaveLength(1);
  expect(option.tooltip).toBeDefined();
});
```

- [ ] **Run test: expect FAIL (buildChartOption missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement chart option helper**

- Export `buildChartOption` that uses `buildFundSeries` and returns an `EChartsOption` with `series` containing the fund series.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Wire fund series helper into ECharts**

- Replace inline fund series configuration to use `buildFundSeries`.

- [ ] **Wire chart option helper into ECharts**

- Replace inline option construction to use `buildChartOption`.

- [ ] **Preserve option structure**

- When extracting `buildChartOption`, keep axis/grid/tooltip/dataZoom/legend structures identical to current behavior; only swap fund series.

- [ ] **Manual verification: option parity**

- Compare chart behavior before/after: axis labels, grid spacing, tooltip format, range tabs, and performance on large series remain unchanged.

- [ ] **Remove legacy pin/label markPoint config**

- Delete the old `markPoint` definitions that use `pin` symbols or label text (e.g., "买"/"锚").

- [ ] **Manual verification: chart integration**

- Open a fund detail chart and confirm markers appear at expected dates.
- Confirm tooltip behavior is unchanged.

- [ ] **Commit**

```bash
git add components/FundDetail.tsx components/FundDetail.test.tsx
git commit -m "fix(charts): render trade markers as colored dots"
```

## Chunk 2: Legend UI

### Task 2: Legend helpers + UI

**Files:**

- Modify: `components/FundDetail.tsx`
- Modify: `services/i18n.tsx`

- [ ] **Write failing test: legend labels helper**

```ts
import { getTradeLegendLabels } from './FundDetail';

it('requests legend i18n keys', () => {
  const calls: string[] = [];
  const t = (key: string) => {
    calls.push(key);
    return key;
  };

  getTradeLegendLabels(t);
  expect(calls).toEqual([
    'common.tradeBuyLabel',
    'common.tradeSellLabel',
    'common.tradeLiquidationLabel',
    'common.tradeAnchorLabel',
  ]);
});
```

- [ ] **Run test: expect FAIL (helper missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement legend labels helper**

- Implement `getTradeLegendLabels` using `t('common.tradeBuyLabel')`, `t('common.tradeSellLabel')`, `t('common.tradeLiquidationLabel')`, `t('common.tradeAnchorLabel')`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Add i18n labels**

- Add `common.tradeBuyLabel`, `common.tradeSellLabel`, `common.tradeLiquidationLabel`, `common.tradeAnchorLabel` to `services/i18n.tsx` (both `en` and `zh`).

- [ ] **Write failing test: legend view-model helper**

```ts
import { buildLegendViewModel } from './FundDetail';

it('builds legend model for watchlist with anchor only', () => {
  const t = (key: string) => key;
  const vm = buildLegendViewModel({ isWatchlist: true, t });

  expect(vm.mode).toBe('watchlist');
  expect(vm.labels.anchor).toBe('common.tradeAnchorLabel');
});
```

- [ ] **Run test: expect FAIL (helper missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement legend view-model helper**

- Export `buildLegendViewModel` that uses `getTradeLegendLabels` and returns `{ mode, labels }` based on `isWatchlist`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: holdings legend labels + dots**

```ts
import { render, screen } from '@testing-library/react';
import { TradeMarkerLegend } from './FundDetail';

it('shows holdings legend labels and dots', () => {
  render(
    <TradeMarkerLegend
      mode="holding"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByText('买入')).toBeInTheDocument();
  expect(screen.getByText('卖出')).toBeInTheDocument();
  expect(screen.getByText('清仓')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-buy')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-sell')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-liquidation')).toBeInTheDocument();
});
```

- [ ] **Run test: expect FAIL (component missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement TradeMarkerLegend (holdings only)**

- Render holding labels + dots for `mode="holding"`.
- Add `data-testid` on dots: `legend-dot-buy`, `legend-dot-sell`, `legend-dot-liquidation`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: watchlist legend shows anchor only**

```ts
it('shows watchlist anchor only', () => {
  render(
    <TradeMarkerLegend
      mode="watchlist"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByText('锚点')).toBeInTheDocument();
  expect(screen.getByTestId('legend-dot-anchor')).toBeInTheDocument();
  expect(screen.queryByTestId('legend-dot-buy')).toBeNull();
  expect(screen.queryByTestId('legend-dot-sell')).toBeNull();
  expect(screen.queryByTestId('legend-dot-liquidation')).toBeNull();
});
```

- [ ] **Run test: expect FAIL (watchlist missing)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Implement watchlist mode for TradeMarkerLegend**

- Render only anchor label + dot for `mode="watchlist"`.
- Add `data-testid` on dot: `legend-dot-anchor`.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Write failing test: legend dot colors**

```ts
it('uses correct dot colors', () => {
  render(
    <TradeMarkerLegend
      mode="holding"
      labels={{ buy: '买入', sell: '卖出', liquidation: '清仓', anchor: '锚点' }}
    />,
  );

  expect(screen.getByTestId('legend-dot-buy')).toHaveStyle({ backgroundColor: '#f87171' });
  expect(screen.getByTestId('legend-dot-sell')).toHaveStyle({ backgroundColor: '#3b82f6' });
  expect(screen.getByTestId('legend-dot-liquidation')).toHaveStyle({ backgroundColor: '#fbbf24' });
});
```

- [ ] **Run test: expect FAIL (colors not applied)**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Apply dot colors**

- Set dot background colors to match marker colors.

- [ ] **Run test: expect PASS**

Run: `npm run test -- components/FundDetail.test.tsx`

- [ ] **Insert legend container into FundDetail**

- Insert the legend row just below the date range title in the chart card.

- [ ] **Wire legend labels into FundDetail**

- Use `useTranslation()` and `buildLegendViewModel` to pass label strings into `TradeMarkerLegend`.

- [ ] **Apply legend styling and visibility**

- Ensure colors are readable in dark mode.
- Ensure legend is always visible and not hover-dependent.

- [ ] **Manual verification: legend integration**

- In dark theme, legend text and dots have sufficient contrast (no gray-on-gray).
- Legend remains visible when hovering the chart and when tooltips appear.

- [ ] **Commit**

```bash
git add components/FundDetail.tsx services/i18n.tsx components/FundDetail.test.tsx
git commit -m "feat(charts): add trade marker legend above fund chart"
```

---

## Verification Checklist

- Buy markers are red dots.
- Sell markers are blue dots.
- Liquidation markers are yellow dots only when inferred via sell-only sequence (sell amounts are shares) and the sell date is on the chart.
- No blue pin markers remain.
- Legend appears above the chart with colored dots and correct labels for holdings vs watchlist.
- Tooltip behavior remains unchanged.
