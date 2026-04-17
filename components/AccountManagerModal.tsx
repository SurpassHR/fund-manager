import React, { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { useTranslation } from '../services/i18n';
import { Icons } from './Icon';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [isComposingNewName, setIsComposingNewName] = useState(false);

  // Edit State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [isComposingEditName, setIsComposingEditName] = useState(false);

  // removed if (!isOpen) return null;
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm sm:p-4"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-[var(--app-shell-panel)] dark:bg-[#1a1a1a] w-full sm:w-[480px] sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl border border-[var(--app-shell-line)] dark:border-white/5 overflow-hidden flex flex-col max-h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--app-shell-line)] dark:border-border-dark shrink-0">
          <h2 className="text-base font-bold text-slate-800 dark:text-gray-100">
            {t('common.manageAccounts')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 -mr-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors text-gray-500"
          >
            <Icons.Plus className="transform rotate-45" size={20} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          <div className="space-y-2">
            {accounts?.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between p-4 bg-[var(--app-shell-panel)] dark:bg-[#1a1a1a] border border-[var(--app-shell-line)] dark:border-white/5 rounded-xl hover:border-blue-200 dark:hover:border-blue-900 transition-colors group"
              >
                {editingId === acc.id ? (
                  // Edit Mode
                  <div className="flex items-center gap-2 w-full">
                    <input
                      autoFocus
                      value={editName}
                      onCompositionStart={() => setIsComposingEditName(true)}
                      onCompositionEnd={(e) => {
                        setIsComposingEditName(false);
                        setEditName(normalizeAccountName(e.currentTarget.value));
                      }}
                      onChange={(e) => {
                        if (isComposingEditName) {
                          setEditName(stripLineBreaks(e.target.value));
                          return;
                        }
                        setEditName(normalizeAccountName(e.target.value));
                      }}
                      className="flex-1 px-3 py-1.5 border border-blue-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 whitespace-nowrap bg-white dark:bg-white/5 dark:border-blue-500/50"
                    />
                    <button
                      onClick={() => handleSaveEdit(acc)}
                      className="text-green-600 p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                    >
                      <Icons.Check size={18} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-gray-400 p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg"
                    >
                      <Icons.X size={18} />
                    </button>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <span className="text-sm font-bold text-slate-700 dark:text-gray-200 truncate whitespace-nowrap flex-1">
                      {t(`filters.${acc.name}`) === `filters.${acc.name}`
                        ? acc.name
                        : t(`filters.${acc.name}`)}
                    </span>

                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleStartEdit(acc)}
                        className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title={t('common.edit')}
                      >
                        <Icons.Edit size={16} />
                      </button>

                      {!acc.isDefault && (
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="text-gray-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
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

        <div className="p-5 border-t border-[var(--app-shell-line)] dark:border-border-dark bg-gray-50/50 dark:bg-white/5 shrink-0">
          {isAdding ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                type="text"
                value={newAccountName}
                onCompositionStart={() => setIsComposingNewName(true)}
                onCompositionEnd={(e) => {
                  setIsComposingNewName(false);
                  setNewAccountName(normalizeAccountName(e.currentTarget.value));
                }}
                onChange={(e) => {
                  if (isComposingNewName) {
                    setNewAccountName(stripLineBreaks(e.target.value));
                    return;
                  }
                  setNewAccountName(normalizeAccountName(e.target.value));
                }}
                placeholder={t('common.accountName')}
                className="w-full px-4 py-2.5 border border-[var(--app-shell-line-strong)] dark:border-white/10 rounded-xl text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 whitespace-nowrap bg-white dark:bg-black/20"
              />
              <div className="flex gap-2 justify-end mt-2">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleAddAccount}
                  className="px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  {t('common.save')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 border-2 border-dashed border-[var(--app-shell-line-strong)] dark:border-white/10 rounded-xl text-slate-500 dark:text-gray-400 text-sm font-bold hover:border-blue-400 dark:hover:border-blue-500/50 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
            >
              <Icons.Plus size={16} />
              {t('common.addAccount')}
            </button>
          )}
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
const normalizeAccountName = (value: string) => {
  const noLineBreak = stripLineBreaks(value).trim();
  return Array.from(noLineBreak).slice(0, 4).join('');
};

const stripLineBreaks = (value: string) => value.replace(/[\r\n]/g, '');
