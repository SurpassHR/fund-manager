import React, { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { Watchlist } from './components/Watchlist';
import { Ticker } from './components/Ticker';
import { ScannerModal } from './components/ScannerModal';
import { SettingsPage } from './components/SettingsPage';
import { WelcomeModal } from './components/WelcomeModal';
import type { TabType } from './types';
import { Icons } from './components/Icon';
import { LanguageProvider, useTranslation } from './services/i18n';
import { ThemeProvider } from './services/ThemeContext';
import { SettingsProvider } from './services/SettingsContext';
import { EdgeSwipeProvider } from './services/edgeSwipeState';
import { resetDragState, useEdgeSwipe } from './services/useEdgeSwipe';
import { closeTopOverlay, getActiveOverlayId } from './services/overlayStack';
import { computeSwipeProgress } from './services/edgeSwipeUtils';

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

    const getScreenWidth = () => window.visualViewport?.width ?? window.innerWidth;

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest('[data-no-edge-swipe]')) return true;
      if (target.closest('input, textarea, select, [contenteditable]')) return true;

      let el: HTMLElement | null = target;
      while (el) {
        const style = window.getComputedStyle(el);
        const overflowX = style.overflowX;
        if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch' || !event.isPrimary) return;
      if (active) return;
      if (shouldIgnoreTarget(event.target)) return;
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
      const dy = event.clientY - startY;
      if (Math.abs(dx) <= 2 * Math.abs(dy)) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        releasePointerCapture();
        return;
      }
      if ((edge === 'left' && dx <= 0) || (edge === 'right' && dx >= 0)) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        releasePointerCapture();
        return;
      }
      const result = computeSwipeProgress({
        edge,
        startX,
        startY,
        currentX: event.clientX,
        currentY: event.clientY,
        screenWidth: width,
      });
      if (!result.isValid) return;
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
        edge = null;
        releasePointerCapture();
        return;
      }

      if (event.cancelable) {
        event.preventDefault();
      }

      setDragState((prev) => ({
        ...prev,
        isDragging: true,
        dragX: result.dragX,
        edge,
        activeOverlayId,
        snapBackX: null,
      }));
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (!active || !edge) return;
      const width = getScreenWidth();
      const result = computeSwipeProgress({
        edge,
        startX,
        startY,
        currentX: event.clientX,
        currentY: event.clientY,
        screenWidth: width,
      });

      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        releasePointerCapture();
        return;
      }

      if (result.isValid && result.shouldClose) {
        const targetX = result.dragX > 0 ? width : -width;
        setDragState((prev) => ({
          ...prev,
          closeTargetX: targetX,
          snapBackX: null,
        }));
        closeTopOverlay({ source: 'edge-swipe', targetX });
      } else {
        const snapX = result.dragX;
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
      edge = null;
      releasePointerCapture();
    };

    const onPointerCancel = (event: PointerEvent) => {
      if (pointerId !== null && event.pointerId !== pointerId) return;
      if (!active) return;
      resetDragState(setDragState);
      active = false;
      edge = null;
      releasePointerCapture();
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      if (shouldIgnoreTarget(event.target)) return;
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
      const dy = touch.clientY - startY;
      if (Math.abs(dx) <= 2 * Math.abs(dy)) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        return;
      }
      if ((edge === 'left' && dx <= 0) || (edge === 'right' && dx >= 0)) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        return;
      }
      const result = computeSwipeProgress({
        edge,
        startX,
        startY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        screenWidth: width,
      });
      if (!result.isValid) return;
      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        return;
      }
      event.preventDefault();
      setDragState((prev) => ({
        ...prev,
        isDragging: true,
        dragX: result.dragX,
        edge,
        activeOverlayId,
        snapBackX: null,
      }));
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!active || !edge) return;
      const width = getScreenWidth();
      const touch = event.changedTouches[0];
      const result = computeSwipeProgress({
        edge,
        startX,
        startY,
        currentX: touch.clientX,
        currentY: touch.clientY,
        screenWidth: width,
      });

      const activeOverlayId = getActiveOverlayId();
      if (!activeOverlayId) {
        resetDragState(setDragState);
        active = false;
        edge = null;
        return;
      }
      if (result.isValid && result.shouldClose) {
        const targetX = result.dragX > 0 ? width : -width;
        setDragState((prev) => ({
          ...prev,
          closeTargetX: targetX,
          snapBackX: null,
        }));
        closeTopOverlay({ source: 'edge-swipe', targetX });
      } else {
        const snapX = result.dragX;
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
      edge = null;
    };

    const onTouchCancel = () => {
      if (!active) return;
      resetDragState(setDragState);
      active = false;
      edge = null;
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
        edge = null;
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
    };
  }, [setDragState]);

  return (
    <div className="bg-app-bg dark:bg-app-bg-dark min-h-screen font-sans text-gray-900 dark:text-gray-100 relative flex flex-col transition-colors">
      <Header title={t('common.appTitle') || 'XiaoHuYangJi'} />

      <main className="flex-grow w-full max-w-7xl mx-auto md:px-4 lg:px-8 relative">
        {renderTabContent()}
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
