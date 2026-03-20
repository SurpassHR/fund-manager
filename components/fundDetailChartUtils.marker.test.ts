import { describe, expect, it } from 'vitest';
import type { PendingTransaction } from '../types';
import { buildTradeMarkersFromTransactions } from './fundDetailChartUtils';

const buildTx = (overrides: Partial<PendingTransaction>): PendingTransaction => ({
  id: 'tx-1',
  type: 'buy',
  date: '2026-03-20',
  time: 'before15',
  amount: 100,
  settlementDate: '2026-03-21',
  settled: false,
  ...overrides,
});

describe('buildTradeMarkersFromTransactions', () => {
  it('maps all transaction types into markers', () => {
    const markers = buildTradeMarkersFromTransactions({
      dates: ['2026-03-20', '2026-03-21', '2026-03-22', '2026-03-23'],
      fundData: [1, 2, 3, 4],
      transactions: [
        buildTx({ id: 'b-1', type: 'buy', date: '2026-03-20' }),
        buildTx({ id: 's-1', type: 'sell', date: '2026-03-21' }),
        buildTx({ id: 'to-1', type: 'transferOut', date: '2026-03-22', outShares: 8, amount: 8 }),
        buildTx({ id: 'ti-1', type: 'transferIn', date: '2026-03-23' }),
      ],
      holdingShares: 10,
    });

    expect(markers.map((m) => m.name)).toEqual(['buy', 'sell', 'sell', 'buy']);
    expect(markers.map((m) => m.coord[0])).toEqual([
      '2026-03-20',
      '2026-03-21',
      '2026-03-22',
      '2026-03-23',
    ]);
  });

  it('includes both settled and unsettled transactions', () => {
    const markers = buildTradeMarkersFromTransactions({
      dates: ['2026-03-20', '2026-03-21'],
      fundData: [1, 2],
      transactions: [
        buildTx({ id: 'settled-buy', type: 'buy', date: '2026-03-20', settled: true }),
        buildTx({ id: 'unsettled-sell', type: 'sell', date: '2026-03-21', settled: false }),
      ],
      holdingShares: 10,
    });

    expect(markers).toHaveLength(2);
    expect(markers.map((m) => m.coord[0])).toEqual(['2026-03-20', '2026-03-21']);
  });

  it('keeps stable ordering for same day by before15 -> after15 -> id', () => {
    const markers = buildTradeMarkersFromTransactions({
      dates: ['2026-03-20'],
      fundData: [1],
      transactions: [
        buildTx({ id: 'tx-b', type: 'sell', date: '2026-03-20', time: 'before15' }),
        buildTx({ id: 'tx-d', type: 'buy', date: '2026-03-20', time: 'after15' }),
        buildTx({ id: 'tx-a', type: 'buy', date: '2026-03-20', time: 'before15' }),
        buildTx({ id: 'tx-c', type: 'sell', date: '2026-03-20', time: 'after15' }),
      ],
      holdingShares: 10,
    });

    expect(markers.map((m) => m.name)).toEqual(['buy', 'sell', 'sell', 'buy']);
    expect(markers.map((m) => m.coord[0])).toEqual([
      '2026-03-20',
      '2026-03-20',
      '2026-03-20',
      '2026-03-20',
    ]);
  });
});
