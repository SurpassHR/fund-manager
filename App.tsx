import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { Watchlist } from './components/Watchlist';
import { Ticker } from './components/Ticker';
import { ScannerModal } from './components/ScannerModal';
import { SettingsPage } from './components/SettingsPage';
import { WelcomeModal } from './components/WelcomeModal';
import { AnimatedSwitcher } from './components/transitions/AnimatedSwitcher';
import type { TabType } from './types';
import { Icons } from './components/Icon';
import { LanguageProvider, useTranslation } from './services/i18n';
import { ThemeProvider } from './services/ThemeContext';
import { SettingsProvider } from './services/SettingsContext';
import { EdgeSwipeProvider } from './services/edgeSwipeState';
import { resetDragState, useEdgeSwipe } from './services/useEdgeSwipe';
import { closeTopOverlay, getActiveOverlayId } from './services/overlayStack';

const EDGE_ZONE = 20;

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('holding');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [openAiSettingsRequested, setOpenAiSettingsRequested] = useState(false);
  const { t } = useTranslation();
  const { setDragState, isDragging } = useEdgeSwipe();
  const isDraggingRef = useRef(isDragging);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'holding':
        return <Dashboard />;
      case 'watchlist':
        return <Watchlist />;
      case 'settings':
        return <SettingsPage initialShowAiSettings={openAiSettingsRequested} />;
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

  useEffect(() => {
    const scannerHandler = () => setIsScannerOpen(true);
    const settingsHandler = () => setActiveTab('settings');
    const aiSettingsHandler = () => {
      setOpenAiSettingsRequested(true);
      setActiveTab('settings');
    };
    window.addEventListener('open-scanner', scannerHandler as EventListener);
    window.addEventListener('open-settings', settingsHandler as EventListener);
    window.addEventListener('open-ai-settings', aiSettingsHandler as EventListener);
    return () => {
      window.removeEventListener('open-scanner', scannerHandler as EventListener);
      window.removeEventListener('open-settings', settingsHandler as EventListener);
      window.removeEventListener('open-ai-settings', aiSettingsHandler as EventListener);
    };
  }, []);

  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let edge: 'left' | 'right' | null = null;
    let active = false;
    let draggingOverlayId: string | null = null;
    let pointerId: number | null = null;
    let captureElement: HTMLElement | null = null;

    const releasePointerCapture = () => {
      if (pointerId === null) return;
      if (captureElement?.hasPointerCapture(pointerId)) {
        captureElement.releasePointerCapture(pointerId);
      }
      captureElement = null;
      pointerId = null;
    };

    const setDragXVar = (dragX: number) => {
      document.documentElement.style.setProperty('--edge-swipe-drag-x', `${dragX}px`);
    };

    const getScreenWidth = () => window.visualViewport?.width ?? window.innerWidth;

    const clampDragX = (currentEdge: 'left' | 'right', dx: number, width: number) => {
      if (currentEdge === 'left') {
        return Math.max(0, Math.min(width, dx));
      }
      return Math.min(0, Math.max(-width, dx));
    };

    const shouldCloseByDragX = (dragX: number, width: number) => Math.abs(dragX) >= 0.5 * width;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      if (active) return;
      const { clientX, clientY } = event;
      const width = getScreenWidth();
      if (clientX <= EDGE_ZONE) edge = 'left';
      else if (clientX >= width - EDGE_ZONE) edge = 'right';
      else edge = null;
      if (!edge) return;

      startX = clientX;
      startY = clientY;
      active = true;
      pointerId = event.pointerId;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (!active || !edge) return;
      const width = getScreenWidth();
      const dx = event.clientX - startX;
      const dragXValue = clampDragX(edge, dx, width);
      if (pointerId !== null && event.target instanceof HTMLElement) {
        const target = event.target;
        if (!target.hasPointerCapture(pointerId)) {
          target.setPointerCapture(pointerId);
        }
        captureElement = target;
      }

      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        draggingOverlayId = null;
        edge = null;
        setDragXVar(0);
        releasePointerCapture();
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      setDragXVar(dragXValue);
      if (draggingOverlayId !== activeOverlayId) {
        draggingOverlayId = activeOverlayId;
        setDragState((prev) => ({
          ...prev,
          isDragging: true,
          dragX: 0,
          edge,
          activeOverlayId,
          snapBackX: null,
        }));
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (!active || !edge) return;
      const width = getScreenWidth();
      const dx = event.clientX - startX;
      const dragXValue = clampDragX(edge, dx, width);
      const shouldClose = shouldCloseByDragX(dragXValue, width);

      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        draggingOverlayId = null;
        edge = null;
        setDragXVar(0);
        releasePointerCapture();
        return;
      }

      if (shouldClose) {
        const targetX = dragXValue > 0 ? width : -width;
        setDragState((prev) => ({
          ...prev,
          closeTargetX: targetX,
          snapBackX: null,
        }));
        closeTopOverlay({ source: 'edge-swipe', targetX });
      } else {
        const snapX = dragXValue;
        setDragState((prev) => ({
          ...prev,
          isDragging: false,
          dragX: snapX,
          closeTargetX: null,
          snapBackX: snapX,
        }));
        requestAnimationFrame(() => {
          setDragState((prev) =>
            prev.snapBackX === snapX
              ? {
                  ...prev,
                  snapBackX: 0,
                }
              : prev,
          );
        });
      }

      active = false;
      draggingOverlayId = null;
      edge = null;
      releasePointerCapture();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (!active) return;
      resetDragState(setDragState);
      active = false;
      draggingOverlayId = null;
      edge = null;
      setDragXVar(0);
      releasePointerCapture();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      const width = getScreenWidth();
      if (touch.clientX <= EDGE_ZONE) edge = 'left';
      else if (touch.clientX >= width - EDGE_ZONE) edge = 'right';
      else edge = null;
      if (!edge) return;
      startX = touch.clientX;
      startY = touch.clientY;
      active = true;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!active || !edge || event.touches.length !== 1) return;
      const width = getScreenWidth();
      const touch = event.touches[0];
      const dx = touch.clientX - startX;
      const dragXValue = clampDragX(edge, dx, width);
      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        draggingOverlayId = null;
        edge = null;
        setDragXVar(0);
        return;
      }
      event.preventDefault();
      setDragXVar(dragXValue);
      if (draggingOverlayId !== activeOverlayId) {
        draggingOverlayId = activeOverlayId;
        setDragState((prev) => ({
          ...prev,
          isDragging: true,
          dragX: 0,
          edge,
          activeOverlayId,
          snapBackX: null,
        }));
      }
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!active || !edge) return;
      const width = getScreenWidth();
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dragXValue = clampDragX(edge, dx, width);
      const shouldClose = shouldCloseByDragX(dragXValue, width);

      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        draggingOverlayId = null;
        edge = null;
        setDragXVar(0);
        return;
      }

      if (shouldClose) {
        const targetX = dragXValue > 0 ? width : -width;
        setDragState((prev) => ({
          ...prev,
          closeTargetX: targetX,
          snapBackX: null,
        }));
        closeTopOverlay({ source: 'edge-swipe', targetX });
      } else {
        const snapX = dragXValue;
        setDragState((prev) => ({
          ...prev,
          isDragging: false,
          dragX: snapX,
          closeTargetX: null,
          snapBackX: snapX,
        }));
        requestAnimationFrame(() => {
          setDragState((prev) =>
            prev.snapBackX === snapX
              ? {
                  ...prev,
                  snapBackX: 0,
                }
              : prev,
          );
        });
      }
      active = false;
      draggingOverlayId = null;
      edge = null;
    };

    const onTouchCancel = () => {
      if (!active) return;
      resetDragState(setDragState);
      active = false;
      draggingOverlayId = null;
      edge = null;
      setDragXVar(0);
    };

    const supportsPointer = 'PointerEvent' in window;
    if (supportsPointer) {
      document.addEventListener('pointerdown', onPointerDown);
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerEnd);
      document.addEventListener('pointercancel', onPointerCancel);
    } else {
      document.addEventListener('touchstart', onTouchStart, { passive: true });
      document.addEventListener('touchmove', onTouchMove, { passive: false });
      document.addEventListener('touchend', onTouchEnd, { passive: true });
      document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    }

    const onResize = () => {
      if (active || isDraggingRef.current) {
        resetDragState(setDragState);
        active = false;
        draggingOverlayId = null;
        edge = null;
        setDragXVar(0);
        releasePointerCapture();
      }
    };
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);

    return () => {
      if (supportsPointer) {
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerEnd);
        document.removeEventListener('pointercancel', onPointerCancel);
      } else {
        document.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchCancel);
      }
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      setDragXVar(0);
    };
  }, [setDragState]);

  return (
    <div className="bg-app-bg dark:bg-app-bg-dark min-h-screen font-sans text-gray-900 dark:text-gray-100 relative flex flex-col transition-colors">
      <Header title={t('common.appTitle') || 'XiaoHuYangJi'} />

      <main className="flex-grow w-full max-w-7xl mx-auto md:px-4 lg:px-8 relative">
        <AnimatedSwitcher viewKey={activeTab} preset="pageFadeLift" mode="wait" className="h-full">
          {renderTabContent()}
        </AnimatedSwitcher>
      </main>

      <Ticker />
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab !== 'settings') {
            setOpenAiSettingsRequested(false);
          }
          setActiveTab(tab);
        }}
      />

      <ScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
      <WelcomeModal />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <SettingsProvider>
      <ThemeProvider>
        <LanguageProvider>
          <EdgeSwipeProvider>
            <AppContent />
          </EdgeSwipeProvider>
        </LanguageProvider>
      </ThemeProvider>
    </SettingsProvider>
  );
};

export default App;
