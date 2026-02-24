import React, { useState } from 'react';
import { Icons } from './Icon';
import { useTranslation } from '../services/i18n';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ isOpen, onClose }) => {
    const [scanning, setScanning] = useState(false);
    const { t } = useTranslation();

    if (!isOpen) return null;

    const handleSimulateScan = () => {
        setScanning(true);
        setTimeout(() => {
            setScanning(false);
            alert(t('common.ocrComplete'));
            onClose();
        }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-card-dark rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-gray-100 dark:border-border-dark flex justify-between items-center bg-gray-50 dark:bg-white/5">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">{t('common.smartEntry')}</h3>
                    <button onClick={onClose}><Icons.Plus className="transform rotate-45 text-gray-400" /></button>
                </div>

                <div className="p-6">
                    <div className="w-full aspect-[3/4] bg-gray-50 dark:bg-white/5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center mb-6 relative overflow-hidden">
                        {scanning ? (
                            <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-500/20 flex flex-col items-center justify-center">
                                <div className="text-blue-600 font-bold">{t('common.ocrProcessing')}</div>
                            </div>
                        ) : (
                            <>
                                <Icons.Scan size={48} className="text-gray-300 dark:text-gray-600 mb-4" />
                                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('common.uploadTip')}</p>
                            </>
                        )}
                    </div>

                    <p className="text-xs text-gray-400 mb-4 px-4">
                        {t('common.ocrPrivacy')}
                    </p>

                    <button
                        onClick={handleSimulateScan}
                        disabled={scanning}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold active:scale-95 transition-transform disabled:opacity-50"
                    >
                        {scanning ? t('common.analyzing') : t('common.selectImage')}
                    </button>
                </div>
            </div>
        </div>
    );
};
