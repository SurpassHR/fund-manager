import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedSwitcher } from './transitions/AnimatedSwitcher';

export type GistChooserItem = {
  id: string;
  description?: string;
  updated_at: string;
  hasSyncFile?: boolean;
  isBackupValid?: boolean;
};

type UploadRequest =
  | { mode: 'create'; description: string }
  | { mode: 'overwrite'; gistId: string; description: string };

interface GistSyncChooserCardProps {
  isOpen: boolean;
  gists: GistChooserItem[];
  onClose: () => void;
  onRequestDownload: (gistId: string) => void;
  onRequestUpload: (payload: UploadRequest) => void;
  defaultMode?: 'download' | 'upload';
  onRefreshList?: () => void;
  isRefreshingList?: boolean;
  refreshCooldownSec?: number;
}

type CardMode = 'download' | 'upload';
type UploadMode = 'create' | 'overwrite';

const MAX_DESCRIPTION_LEN = 25;

export const formatGistUpdatedAt = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hour = String(parsed.getHours()).padStart(2, '0');
  const minute = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

export const GistSyncChooserCard: React.FC<GistSyncChooserCardProps> = ({
  isOpen,
  gists,
  onClose,
  onRequestDownload,
  onRequestUpload,
  defaultMode = 'download',
  onRefreshList,
  isRefreshingList = false,
  refreshCooldownSec = 0,
}) => {
  const [cardMode, setCardMode] = useState<CardMode>(defaultMode);
  const [selectedGistId, setSelectedGistId] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<UploadMode>('create');
  const [description, setDescription] = useState<string>('');

  const descriptionLen = description.length;
  const isDownloadConfirmDisabled = !selectedGistId;
  const isOverwriteConfirmDisabled = uploadMode === 'overwrite' && !selectedGistId;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const title = cardMode === 'download' ? '选择要下载的 Gist' : '选择上传方式';

  const sortedGists = useMemo(
    () =>
      [...gists].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      ),
    [gists],
  );

  const handleModeChange = (mode: CardMode) => {
    setCardMode(mode);
    setSelectedGistId('');
  };

  const handleDescriptionChange = (nextValue: string) => {
    setDescription(nextValue.slice(0, MAX_DESCRIPTION_LEN));
  };

  const handleDownloadConfirm = () => {
    if (!selectedGistId) return;
    onRequestDownload(selectedGistId);
  };

  const handleUploadConfirm = () => {
    if (uploadMode === 'create') {
      onRequestUpload({ mode: 'create', description: description.trim() });
      return;
    }

    if (!selectedGistId) return;
    onRequestUpload({ mode: 'overwrite', gistId: selectedGistId, description: description.trim() });
  };

  const gistListSection = (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {sortedGists.map((item) => {
        const selected = selectedGistId === item.id;
        const disabledForDownload = cardMode === 'download' && item.isBackupValid === false;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (disabledForDownload) return;
              setSelectedGistId(item.id);
            }}
            disabled={disabledForDownload}
            className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${
              selected
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
                : 'border-gray-100 dark:border-border-dark hover:bg-gray-50 dark:hover:bg-white/5'
            } ${disabledForDownload ? 'opacity-60 cursor-not-allowed' : ''}`}
            aria-label={`选择 ${item.description || '无描述'} ${formatGistUpdatedAt(item.updated_at)}`}
          >
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
              {item.description || '无描述'}
            </div>
            <div className="mt-1 text-xs text-gray-500">最后修改：{formatGistUpdatedAt(item.updated_at)}</div>
            {item.hasSyncFile === false && (
              <div className="mt-1 text-[11px] text-amber-600">未命中同步文件</div>
            )}
            {item.isBackupValid === false && (
              <div className="mt-1 text-[11px] text-red-500">备份格式无效（仅可覆盖修复）</div>
            )}
            {item.isBackupValid === true && (
              <div className="mt-1 text-[11px] text-emerald-600">备份格式有效</div>
            )}
          </button>
        );
      })}
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-lg rounded-2xl bg-white dark:bg-card-dark overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 dark:border-border-dark flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">{title}</h3>
              <div className="flex items-center gap-2">
                {cardMode === 'download' && onRefreshList && (
                  <button
                    type="button"
                    onClick={onRefreshList}
                    disabled={isRefreshingList || refreshCooldownSec > 0}
                    className="text-xs px-2 py-1 rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 disabled:opacity-50"
                  >
                    {isRefreshingList
                      ? '刷新中...'
                      : refreshCooldownSec > 0
                        ? `刷新(${refreshCooldownSec}s)`
                        : '刷新'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  关闭
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 dark:bg-white/5 p-1">
                <button
                  type="button"
                  className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                    cardMode === 'download'
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => handleModeChange('download')}
                >
                  从 Gist 下载
                </button>
                <button
                  type="button"
                  className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                    cardMode === 'upload'
                      ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-gray-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                  onClick={() => handleModeChange('upload')}
                >
                  上传到 Gist
                </button>
              </div>

              <AnimatedSwitcher
                viewKey={cardMode === 'download' ? 'download' : `upload-${uploadMode}`}
                preset="sectionFadeLift"
                enableExit={false}
              >
                <div className="space-y-3">
                  {cardMode === 'upload' && (
                    <div className="space-y-3 rounded-xl border border-gray-100 dark:border-border-dark p-3">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className={`rounded-lg py-2 text-sm transition-colors ${
                            uploadMode === 'create'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200'
                          }`}
                          onClick={() => {
                            setUploadMode('create');
                            setSelectedGistId('');
                          }}
                        >
                          新建 Gist
                        </button>
                        <button
                          type="button"
                          className={`rounded-lg py-2 text-sm transition-colors ${
                            uploadMode === 'overwrite'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200'
                          }`}
                          onClick={() => setUploadMode('overwrite')}
                        >
                          覆盖已有 Gist
                        </button>
                      </div>

                      <div className="space-y-1">
                        <label
                          htmlFor="gist-description"
                          className="block text-xs font-medium text-gray-500"
                        >
                          Gist 描述
                        </label>
                        <input
                          id="gist-description"
                          value={description}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-white/5 px-3 py-2 text-sm"
                          placeholder="例如：fund-manager 自动备份"
                        />
                        <p className="text-[11px] text-gray-400">{descriptionLen} / 25</p>
                      </div>
                    </div>
                  )}

                  {(cardMode === 'download' || uploadMode === 'overwrite') && gistListSection}
                </div>
              </AnimatedSwitcher>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/5"
                >
                  取消
                </button>

                {cardMode === 'download' ? (
                  <button
                    type="button"
                    onClick={handleDownloadConfirm}
                    disabled={isDownloadConfirmDisabled}
                    className="rounded-lg px-3 py-2 text-sm text-white bg-blue-600 disabled:opacity-50"
                  >
                    确认下载
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleUploadConfirm}
                    disabled={isOverwriteConfirmDisabled}
                    className="rounded-lg px-3 py-2 text-sm text-white bg-blue-600 disabled:opacity-50"
                  >
                    {uploadMode === 'create' ? '确认创建并上传' : '确认覆盖并上传'}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
