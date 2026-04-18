/// <reference types="vitest/globals" />
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddFundModal } from '../AddFundModal';
import type { Fund, WatchlistItem } from '../../types';

const mocked = vi.hoisted(() => {
  const fundsAdd = vi.fn();
  const fundsUpdate = vi.fn();
  const accounts = [{ id: 1, name: 'Default', isDefault: true }];

  return {
    accounts,
    fundsAdd,
    fundsUpdate,
  };
});

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));

vi.mock('../../services/db', () => ({
  db: {
    accounts: {
      toArray: () => mocked.accounts,
    },
    funds: {
      add: mocked.fundsAdd,
      update: mocked.fundsUpdate,
    },
  },
}));

vi.mock('../../services/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../services/api', () => ({
  searchFunds: vi.fn(),
  fetchFundCommonData: vi.fn(),
}));

vi.mock('../../services/useEdgeSwipe', () => ({
  resetDragState: vi.fn(),
  useEdgeSwipe: () => ({
    isDragging: false,
    activeOverlayId: null,
    setDragState: vi.fn(),
    snapBackX: null,
  }),
}));

vi.mock('../../services/overlayRegistration', () => ({
  useOverlayRegistration: vi.fn(),
}));

vi.mock('../Icon', () => ({
  Icons: {
    Plus: () => <span>plus</span>,
    Search: () => <span>search</span>,
  },
}));

const prefillItem: WatchlistItem = {
  id: 1,
  code: '000001',
  name: '测试基金',
  type: 'fund',
  anchorPrice: 1.2345,
  anchorDate: '2026-04-01',
  currentPrice: 1.2345,
  dayChangePct: 0.3,
  lastUpdate: '2026-04-01',
};

const setSharesValue = (value: string) => {
  const sharesLabel = screen.getByText('common.shares');
  const sharesInput = sharesLabel.parentElement?.querySelector('input');
  if (!sharesInput) {
    throw new Error('未找到份额输入框');
  }
  fireEvent.change(sharesInput, { target: { value } });
};

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const getBuyDateInput = () => {
  const label = screen.getByText('common.buyDate');
  const input = label.parentElement?.querySelector('input');
  if (!input) {
    throw new Error('未找到买入日期输入框');
  }
  return input as HTMLInputElement;
};

const editFund: Fund = {
  id: 1,
  code: '000001',
  name: '测试基金',
  platform: 'Default',
  holdingShares: 10,
  costPrice: 1.2,
  currentNav: 1.3,
  lastUpdate: '2026-04-01',
  dayChangePct: 0.3,
  dayChangeVal: 0.03,
  buyDate: '2026-04-01',
  buyTime: 'before15',
  settlementDays: 1,
};

describe('AddFundModal submit lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应阻止确认按钮重复点击导致重复添加', async () => {
    const addDeferred = createDeferred<number>();
    mocked.fundsAdd.mockReturnValue(addDeferred.promise);

    render(
      <AddFundModal
        isOpen
        onClose={vi.fn()}
        prefillWatchlistItem={prefillItem}
        onFundAdded={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('10');

    const confirmButton = screen.getByRole('button', { name: 'common.confirm' });
    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    expect(mocked.fundsAdd).toHaveBeenCalledTimes(1);

    await act(async () => {
      addDeferred.resolve(1);
      await addDeferred.promise;
    });
  });

  it('新增成功后应先关闭弹窗，不等待 onFundAdded 完成', async () => {
    mocked.fundsAdd.mockResolvedValue(1);
    const refreshDeferred = createDeferred<void>();
    const onFundAdded = vi.fn(() => refreshDeferred.promise);
    const onClose = vi.fn();

    render(
      <AddFundModal
        isOpen
        onClose={onClose}
        prefillWatchlistItem={prefillItem}
        onFundAdded={onFundAdded}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'common.confirm' })).toBeTruthy();
    });

    setSharesValue('12');
    fireEvent.click(screen.getByRole('button', { name: 'common.confirm' }));

    await waitFor(() => {
      expect(mocked.fundsAdd).toHaveBeenCalledTimes(1);
    });

    // onClose should be called immediately after fundsAdd, before onFundAdded completes
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    // onFundAdded is called but may not have completed yet
    expect(onFundAdded).toHaveBeenCalledTimes(1);

    // Clean up the pending refresh promise
    await act(async () => {
      refreshDeferred.resolve();
      await refreshDeferred.promise;
    });
  });

  it('买入日期键盘方向键不应拦截原生行为', async () => {
    render(<AddFundModal isOpen onClose={vi.fn()} editFund={editFund} />);

    const buyDateInput = getBuyDateInput();
    const notCancelled = fireEvent.keyDown(buyDateInput, { key: 'ArrowDown' });

    expect(notCancelled).toBe(true);
  });

  it('买入日期变更为空字符串时应保留当前日期', async () => {
    render(
      <AddFundModal isOpen onClose={vi.fn()} editFund={{ ...editFund, buyDate: '2026-04-01' }} />,
    );

    const buyDateInput = getBuyDateInput();
    expect(buyDateInput.value).toBe('2026-04-01');

    fireEvent.change(buyDateInput, { target: { value: '' } });

    expect(buyDateInput.value).toBe('2026-04-01');
  });

  it('买入日期变更为合法日期时应正常更新', async () => {
    render(<AddFundModal isOpen onClose={vi.fn()} editFund={editFund} />);

    const buyDateInput = getBuyDateInput();
    expect(buyDateInput.value).toBe('2026-04-01');

    fireEvent.change(buyDateInput, { target: { value: '2026-03-31' } });

    expect(buyDateInput.value).toBe('2026-03-31');
  });
});
