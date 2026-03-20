/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AccountManagerModal } from './AccountManagerModal';
import { useLiveQuery } from 'dexie-react-hooks';

const mockedUseLiveQuery = vi.mocked(useLiveQuery);

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(() => []),
}));

vi.mock('../services/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../services/db', () => ({
  db: {
    accounts: {
      add: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      toArray: vi.fn(async () => []),
    },
    funds: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          modify: vi.fn(),
        })),
      })),
    },
    transaction: vi.fn(
      async (_mode: string, _accounts: unknown, _funds: unknown, fn: () => Promise<void>) => {
        await fn();
      },
    ),
  },
}));

describe('AccountManagerModal 输入法兼容', () => {
  it('编辑账户时，拼音输入进行中不应被4字限制截断', () => {
    mockedUseLiveQuery.mockReturnValue([
      {
        id: 1,
        name: '账户A',
        isDefault: false,
      },
    ]);

    render(<AccountManagerModal isOpen={true} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'common.edit' }));

    const input = screen.getByDisplayValue('账户A');
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'pinyinabcdef' } });
    expect(input).toHaveValue('pinyinabcdef');

    fireEvent.compositionEnd(input, { target: { value: '编辑账户超长' } });
    expect(input).toHaveValue('编辑账户');
  });

  it('新增账户时，拼音输入进行中不应被4字限制截断', () => {
    mockedUseLiveQuery.mockReturnValue([]);

    render(<AccountManagerModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'common.addAccount' }));
    const input = screen.getByPlaceholderText('common.accountName');

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'pinyinabcdef' } });
    expect(input).toHaveValue('pinyinabcdef');

    fireEvent.compositionEnd(input, { target: { value: '中文测试超长' } });
    expect(input).toHaveValue('中文测试');
  });
});
