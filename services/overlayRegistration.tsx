import { useEffect, useRef } from 'react';
import { registerOverlay, unregisterOverlay } from './overlayStack';

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
    registerOverlay(id, handleClose);
    return () => unregisterOverlay(id);
  }, [id, isOpen]);
};
