import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import type { Account } from '../types';

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountManagerModal: React.FC<AccountManagerModalProps> = ({ isOpen, onClose }) => {
  const accounts = useLiveQuery(() => db.accounts.toArray());
  const { t } = useTranslation();

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

  // Add State
  const [newAccountName, setNewAccountName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const handleAddAccount = async () => {
    const normalized = normalizeAccountName(newAccountName);
    if (normalized) {
      await db.accounts.add({ name: normalized, isDefault: false });
      setNewAccountName('');
      setIsAdding(false);
    }
  };

  const handleDeleteAccount = async (id?: number) => {
    if (id) {
      if (confirm(t('common.delete') + '?')) {
        await db.accounts.delete(id);
      }
    }
  };

  const handleStartEdit = (acc: Account) => {
    if (acc.id) {
      setEditingId(acc.id);
      setEditName(acc.name);
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (acc: Account) => {
    const newName = normalizeAccountName(editName);
    if (!newName || !acc.id) return;

    if (newName === acc.name) {
      handleCancelEdit();
      return;
    }

    const oldName = acc.name;

    await db.transaction('rw', db.accounts, db.funds, async () => {
      await db.accounts.update(acc.id!, { name: newName });
      // Cascading update: find funds with old platform name and update to new name
      await db.funds.where('platform').equals(oldName).modify({ platform: newName });
    });

    handleCancelEdit();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-card-dark rounded-lg w-full max-w-sm overflow-hidden shadow-xl animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5 shrink-0">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">
            {t('common.manageAccounts')}
          </h2>
          <button onClick={onClose}>
            <Icons.Plus className="transform rotate-45 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto">
          <div className="space-y-2">
            {accounts?.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-3 bg-white dark:bg-[#1a1a1a] border border-gray-100 dark:border-white/5 rounded-lg hover:border-blue-100 dark:hover:border-blue-900 transition-colors group"
              >
                {editingId === acc.id ? (
                  // Edit Mode
                  <div className="flex items-center gap-2 w-full">
                    <input
                      autoFocus
                      value={editName}
                      maxLength={4}
                      onChange={(e) => setEditName(normalizeAccountName(e.target.value))}
                      className="flex-1 px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 whitespace-nowrap"
                    />
                    <button
                      onClick={() => handleSaveEdit(acc)}
                      className="text-green-600 p-1 hover:bg-green-50 rounded"
                    >
                      <Icons.Check size={18} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-400 p-1 hover:bg-gray-100 rounded"
                    >
                      <Icons.X size={18} />
                    </button>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <span className="text-sm font-medium text-gray-700 truncate whitespace-nowrap flex-1">
                      {t(`filters.${acc.name}`) === `filters.${acc.name}`
                        ? acc.name
                        : t(`filters.${acc.name}`)}
                    </span>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(acc)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-blue-50"
                        title={t('common.edit')}
                      >
                        <Icons.Edit size={16} />
                      </button>

                      {!acc.isDefault && (
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50"
                          title={t('common.delete')}
                        >
                          <Icons.Trash size={16} />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-border-dark bg-gray-50 dark:bg-white/5 shrink-0">
          {isAdding ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                value={newAccountName}
                maxLength={4}
                onChange={(e) => setNewAccountName(normalizeAccountName(e.target.value))}
                placeholder={t('common.accountName')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 whitespace-nowrap"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddAccount}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              <Icons.Plus size={16} />
              {t('common.addAccount')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
const normalizeAccountName = (value: string) => {
  const noLineBreak = value.replace(/[\r\n]/g, '').trim();
  return Array.from(noLineBreak).slice(0, 4).join('');
};
