import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { type AnimationPresetName, getAnimationPreset } from '../../services/animations/presets';

interface AnimatedSwitcherProps {
  viewKey: string;
  children: React.ReactNode;
  preset?: AnimationPresetName;
  className?: string;
  mode?: 'sync' | 'wait' | 'popLayout';
  enableExit?: boolean;
}

export const AnimatedSwitcher: React.FC<AnimatedSwitcherProps> = ({
  viewKey,
  children,
  preset = 'pageFadeLift',
  className,
  mode = 'sync',
  enableExit = true,
}) => {
  const reduceMotion = useReducedMotion();
  const animationPreset = getAnimationPreset(preset, reduceMotion);

  if (!enableExit) {
    return (
      <motion.div
        key={viewKey}
        className={className}
        initial={animationPreset.initial}
        animate={animationPreset.animate}
        transition={animationPreset.transition}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode={mode} initial={false}>
      <motion.div
        key={viewKey}
        className={className}
        initial={animationPreset.initial}
        animate={animationPreset.animate}
        exit={animationPreset.exit}
        transition={animationPreset.transition}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
