import React, { useCallback, useContext, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DragContext, type DragState } from '../services/edgeSwipeContext';
import { resetDragState } from '../services/useEdgeSwipe';
import { useOverlayRegistration } from '../services/overlayRegistration';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  overlayId: string;
  children: React.ReactNode;
  /** 卡片额外 className（仅用于结构/布局覆盖，不包含背景色） */
  className?: string;
  /** 容器 z-index，默认 z-[60] */
  zIndex?: string;
  /** 是否启用边缘滑动关闭 */
  edgeSwipe?: boolean;
  /** 卡片点击事件（默认阻止冒泡） */
  onCardClick?: (e: React.MouseEvent) => void;
  /** backdrop 点击回调，默认 onClose */
  onBackdropClick?: () => void;
  /** AnimatePresence exit 完成回调 */
  onExitComplete?: () => void;
}

const ACRYLIC_CARD = 'bg-white/10 dark:bg-card-dark/10 backdrop-blur-xl';
const STRUCTURAL_CARD =
  'rounded-t-2xl sm:rounded-xl w-full sm:max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]';

const noopSetDragState: React.Dispatch<React.SetStateAction<DragState>> = () => {};

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  overlayId,
  children,
  className,
  zIndex = 'z-[60]',
  edgeSwipe = false,
  onCardClick,
  onBackdropClick,
  onExitComplete,
}) => {
  const cardClassName = `${ACRYLIC_CARD} ${className || STRUCTURAL_CARD}`;
  const ctx = useContext(DragContext);
  const isDragging = ctx?.isDragging ?? false;
  const activeOverlayId = ctx?.activeOverlayId ?? null;
  const setDragState = ctx?.setDragState ?? noopSetDragState;
  const snapBackX = ctx?.snapBackX ?? null;

  const [closeTargetX, setCloseTargetX] = useState<number | null>(null);
  const isGestureCloseRef = useRef(false);

  const translateX =
    edgeSwipe && isDragging && activeOverlayId === overlayId
      ? 'var(--edge-swipe-drag-x, 0px)'
      : '0px';
  const snapX = edgeSwipe && activeOverlayId === overlayId ? snapBackX : null;
  const transformX =
    closeTargetX !== null ? `${closeTargetX}px` : snapX !== null ? `${snapX}px` : translateX;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const requestClose = useCallback(
    (payload?: { source?: 'edge-swipe' | 'programmatic'; targetX?: number }) => {
      if (edgeSwipe && payload?.targetX !== undefined) {
        isGestureCloseRef.current = true;
        setCloseTargetX(payload.targetX);
        return;
      }
      handleClose();
    },
    [edgeSwipe, handleClose],
  );

  useOverlayRegistration(overlayId, isOpen, requestClose);

  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 ${zIndex} flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-md sm:p-4`}
          onClick={onBackdropClick ?? handleClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            transform: edgeSwipe ? `translateX(${transformX})` : undefined,
            transition:
              edgeSwipe && (closeTargetX !== null || snapX !== null)
                ? 'transform 220ms ease'
                : undefined,
          }}
          onTransitionEnd={
            edgeSwipe
              ? () => {
                  if (closeTargetX !== null) {
                    if (isGestureCloseRef.current) {
                      // 手势关闭：不重置 closeTargetX，保持卡片在屏幕外，由 exit 动画淡出 backdrop
                      isGestureCloseRef.current = false;
                      handleClose();
                      return;
                    }
                    setCloseTargetX(null);
                    resetDragState(setDragState);
                    handleClose();
                    return;
                  }
                  if (snapX !== null) {
                    resetDragState(setDragState);
                  }
                }
              : undefined
          }
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={cardClassName}
            onClick={onCardClick ?? ((e) => e.stopPropagation())}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
