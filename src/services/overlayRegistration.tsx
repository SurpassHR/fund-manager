import { useEffect, useRef } from 'react';
import { registerOverlay, unregisterOverlay } from './overlayStack';

let scrollLockCount = 0;
let previousBodyOverflow = '';
let previousHtmlOverflow = '';

const lockPageScroll = () => {
  if (typeof document === 'undefined') return;

  if (scrollLockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  scrollLockCount += 1;
};

const unlockPageScroll = () => {
  if (typeof document === 'undefined' || scrollLockCount === 0) return;

  scrollLockCount -= 1;

  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
  }
};

export const useOverlayRegistration = (
  id: string,
  isOpen: boolean,
  requestClose: (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => void,
) => {
  const requestCloseRef = useRef(requestClose);

  useEffect(() => {
    requestCloseRef.current = requestClose;
  }, [requestClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClose = (payload?: {
      source?: 'edge-swipe' | 'programmatic';
      targetX?: number;
    }) => {
      requestCloseRef.current(payload);
    };

    lockPageScroll();
    registerOverlay(id, handleClose);

    return () => {
      unregisterOverlay(id);
      unlockPageScroll();
    };
  }, [id, isOpen]);
};
