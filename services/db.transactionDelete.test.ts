import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Fund, PendingTransaction } from '../types';
import { db, deletePendingTransaction } from './db';

const buildTx = (overrides?: Partial<PendingTransaction>): PendingTransaction => ({
  id: 'tx-1',
  type: 'buy',
  date: '2026-03-20',
  time: 'before15',
  amount: 100,
  settlementDate: '2026-03-21',
  settled: false,
  ...overrides,
});

const buildFund = (id: number, txs: PendingTransaction[]): Fund => ({
  id,
  code: `00000${id}`,
  name: `基金${id}`,
  platform: '天天基金',
  holdingShares: 100,
  costPrice: 1,
  currentNav: 1,
  lastUpdate: '2026-03-20',
  dayChangePct: 0,
  dayChangeVal: 0,
  pendingTransactions: txs,
});

describe('deletePendingTransaction', () => {
  const mockTransaction = () =>
    vi.spyOn(db, 'transaction').mockImplementation((...args: unknown[]) => {
      const scope = args[args.length - 1] as () => unknown;
      return Promise.resolve(scope()) as never;
    });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes a single pending transaction within one fund', async () => {
    const targetTx = buildTx({ id: 'single-delete' });
    const keepTx = buildTx({ id: 'keep-me' });
    const fund = buildFund(1, [targetTx, keepTx]);

    mockTransaction();
    vi.spyOn(db.funds, 'get').mockResolvedValue(fund);
    const updateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);

    const result = await deletePendingTransaction({
      fundId: 1,
      txId: 'single-delete',
      type: 'buy',
    });

    expect(result).toEqual({
      deletedCount: 1,
      affectedFundIds: [1],
      linkedDelete: false,
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        pendingTransactions: [expect.objectContaining({ id: 'keep-me' })],
      }),
    );
  });

  it('deletes linked transfer transactions across funds atomically', async () => {
    const transferId = 'transfer-1';
    const sourceTx = buildTx({ id: 'tx-out', type: 'transferOut', transferId });
    const targetTx = buildTx({ id: 'tx-in', type: 'transferIn', transferId });

    const sourceFund = buildFund(1, [sourceTx]);
    const targetFund = buildFund(2, [targetTx]);

    vi.spyOn(db.funds, 'toArray').mockResolvedValue([sourceFund, targetFund]);
    const updateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);
    const transactionSpy = mockTransaction();

    const result = await deletePendingTransaction({
      fundId: 1,
      txId: 'tx-out',
      transferId,
      type: 'transferOut',
    });

    expect(result).toEqual({
      deletedCount: 2,
      affectedFundIds: [1, 2],
      linkedDelete: true,
    });
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(updateSpy).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ pendingTransactions: [] }),
    );
    expect(updateSpy).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ pendingTransactions: [] }),
    );
  });

  it('rejects linked delete when matched transfer records exceed guardrail', async () => {
    const transferId = 'transfer-over-limit';
    const txA = buildTx({ id: 'tx-a', type: 'transferOut', transferId });
    const txB = buildTx({ id: 'tx-b', type: 'transferIn', transferId });
    const txC = buildTx({ id: 'tx-c', type: 'transferIn', transferId });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.spyOn(db.funds, 'toArray').mockResolvedValue([
      buildFund(1, [txA]),
      buildFund(2, [txB]),
      buildFund(3, [txC]),
    ]);
    const updateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);

    const result = await deletePendingTransaction({
      fundId: 1,
      txId: 'tx-a',
      transferId,
      type: 'transferOut',
    });

    expect(result).toMatchObject({
      code: 'LINKED_DELETE_OVER_LIMIT',
      userMessageKey: 'common.linkedDeleteOverLimit',
      linkedDelete: true,
      deletedCount: 0,
      affectedFundIds: [],
      logFields: {
        transferId,
        matchedCount: 3,
        fundId: 1,
      },
    });
    expect(warnSpy).toHaveBeenCalledWith(
      '[deletePendingTransaction] linked delete matched over limit',
      expect.objectContaining({
        transferId,
        matchedCount: 3,
        fundId: 1,
      }),
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not trigger cross-fund linked delete when anchor txId does not match fund transaction', async () => {
    const transferId = 'transfer-anchor-check';
    const sourceTx = buildTx({ id: 'tx-out', type: 'transferOut', transferId });
    const targetTx = buildTx({ id: 'tx-in', type: 'transferIn', transferId });

    vi.spyOn(db.funds, 'toArray').mockResolvedValue([buildFund(1, [sourceTx]), buildFund(2, [targetTx])]);
    const updateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);

    const result = await deletePendingTransaction({
      fundId: 1,
      txId: 'non-exist-tx',
      transferId,
      type: 'transferOut',
    });

    expect(result).toEqual({
      deletedCount: 0,
      affectedFundIds: [],
      linkedDelete: true,
    });
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('does not trigger linked delete for buy/sell even when transferId exists', async () => {
    const tx = buildTx({ id: 'tx-buy-with-transfer', type: 'buy', transferId: 'fake-transfer-id' });
    const fund = buildFund(7, [tx]);

    mockTransaction();
    vi.spyOn(db.funds, 'get').mockResolvedValue(fund);
    const updateSpy = vi.spyOn(db.funds, 'update').mockResolvedValue(1);

    const result = await deletePendingTransaction({
      fundId: 7,
      txId: 'tx-buy-with-transfer',
      transferId: 'fake-transfer-id',
      type: 'buy',
    });

    expect(result).toEqual({
      deletedCount: 1,
      affectedFundIds: [7],
      linkedDelete: false,
    });
    expect(updateSpy).toHaveBeenCalledTimes(1);
  });
});
