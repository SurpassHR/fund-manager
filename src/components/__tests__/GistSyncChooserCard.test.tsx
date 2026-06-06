/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GistSyncChooserCard } from '../GistSyncChooserCard';

const mockGists = [
  {
    id: 'gist-1',
    description: '我的持仓备份',
    updated_at: '2026-03-19T09:10:00.000Z',
    hasSyncFile: true,
  },
  {
    id: 'gist-2',
    description: '',
    updated_at: '2026-03-18T10:00:00.000Z',
    hasSyncFile: false,
  },
];

describe('GistSyncChooserCard', () => {
  it('supports mode switching between download and upload', () => {
    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={vi.fn()}
        onRequestUpload={vi.fn()}
      />,
    );

    expect(screen.getByText('选择要下载的 Gist')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '上传到 Gist' }));

    expect(screen.getByText('选择上传方式')).toBeTruthy();
    expect(screen.getByRole('button', { name: '新建 Gist' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '覆盖已有 Gist' })).toBeTruthy();
  });

  it('shows gist description and readable updated time', () => {
    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={vi.fn()}
        onRequestUpload={vi.fn()}
      />,
    );

    expect(screen.getByText('我的持仓备份')).toBeTruthy();
    expect(screen.getByText('无描述')).toBeTruthy();
    expect(screen.getByText(/最后修改：2026-03-19 \d{2}:10/)).toBeTruthy();
  });

  it('selects gist and triggers download callback', () => {
    const onRequestDownload = vi.fn();

    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={onRequestDownload}
        onRequestUpload={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /我的持仓备份/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认下载' }));

    expect(onRequestDownload).toHaveBeenCalledWith('gist-1');
  });

  it('limits description length to 25 in upload create mode', () => {
    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={vi.fn()}
        onRequestUpload={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '上传到 Gist' }));
    fireEvent.click(screen.getByRole('button', { name: '新建 Gist' }));

    const input = screen.getByLabelText('Gist 描述');
    fireEvent.change(input, {
      target: { value: '1234567890123456789012345678901234567890' },
    });

    expect((input as HTMLInputElement).value).toBe('1234567890123456789012345');
    expect(screen.getByText('25 / 25')).toBeTruthy();
  });

  it('supports upload create and overwrite interactions', () => {
    const onRequestUpload = vi.fn();

    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={vi.fn()}
        onRequestUpload={onRequestUpload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '上传到 Gist' }));

    fireEvent.change(screen.getByLabelText('Gist 描述'), {
      target: { value: '每周同步备份' },
    });
    fireEvent.click(screen.getByRole('button', { name: '确认创建并上传' }));
    expect(onRequestUpload).toHaveBeenCalledWith({ mode: 'create', description: '每周同步备份' });

    fireEvent.click(screen.getByRole('button', { name: '覆盖已有 Gist' }));
    fireEvent.click(screen.getByRole('button', { name: /我的持仓备份/ }));
    fireEvent.click(screen.getByRole('button', { name: '确认覆盖并上传' }));

    expect(onRequestUpload).toHaveBeenCalledWith({
      mode: 'overwrite',
      gistId: 'gist-1',
      description: '每周同步备份',
    });
  });

  it('shows refresh button and enforces cooldown state', () => {
    const onRefreshList = vi.fn();

    render(
      <GistSyncChooserCard
        isOpen
        gists={mockGists}
        onClose={vi.fn()}
        onRequestDownload={vi.fn()}
        onRequestUpload={vi.fn()}
        onRefreshList={onRefreshList}
        refreshCooldownSec={0}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '刷新' }));
    expect(onRefreshList).toHaveBeenCalledTimes(1);
  });
});
