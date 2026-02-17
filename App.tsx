import React, { useState } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { Ticker } from './components/Ticker';
import { ScannerModal } from './components/ScannerModal';
import { MePage } from './components/MePage';
import { TabType } from './types';
import { Icons } from './components/Icon';
import { LanguageProvider, useTranslation } from './services/i18n';
import { ThemeProvider } from './services/ThemeContext';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('holding');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const { t } = useTranslation();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'holding':
        return <Dashboard />;
      case 'me':
        return <MePage />;
      default:
        return (
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
        );
    }
  };

  return (
    <div className="bg-app-bg dark:bg-app-bg-dark min-h-screen font-sans text-gray-900 dark:text-gray-100 relative flex flex-col transition-colors">
      <Header title={t('common.appTitle') || "XiaoHuYangJi"} />

      <main className="flex-grow w-full max-w-7xl mx-auto md:px-4 lg:px-8 relative">
        {renderTabContent()}
      </main>

      <Ticker />
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </ThemeProvider>
  );
};

export default App;