import React, { useState } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { Ticker } from './components/Ticker';
import { ScannerModal } from './components/ScannerModal';
import { TabType } from './types';
import { Icons } from './components/Icon';
import { LanguageProvider, useTranslation } from './services/i18n';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('holding');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="bg-app-bg min-h-screen font-sans text-gray-900 relative flex flex-col">
      <Header title={t('common.appTitle') || "YangJiBao"} />
      
      <main className="flex-grow w-full max-w-7xl mx-auto md:px-4 lg:px-8 relative">
        {activeTab === 'holding' && <Dashboard />}
        {activeTab !== 'holding' && (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-4">
                <Icons.Grid size={48} strokeWidth={1} />
                <p>{t('common.underConstruction', { module: t(`common.${activeTab}`) })}</p>
                <button 
                    onClick={() => setActiveTab('holding')}
                    className="text-blue-500 font-medium hover:underline"
                >
                    {t('common.return')}
                </button>
            </div>
        )}
      </main>
      
      {/* Floating Action Button removed as requested */}

      <Ticker />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      
      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;