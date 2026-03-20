import type { TargetAndTransition, Transition } from 'framer-motion';

export type AnimationPresetName = 'pageFadeLift' | 'sectionFadeLift';

export interface AnimationPreset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

export interface BottomNavAnimationConfig {
  indicatorTransition: Transition;
  iconScaleActive: number;
  iconScaleInactive: number;
  iconScaleTransition: Transition;
}

const REDUCED_TRANSITION: Transition = {
  duration: 0.12,
  ease: 'easeOut',
};

const REDUCED_PRESET: AnimationPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: REDUCED_TRANSITION,
};

const PRESETS: Record<AnimationPresetName, AnimationPreset> = {
  pageFadeLift: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: {
      duration: 0.2,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  sectionFadeLift: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: {
      duration: 0.16,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const BOTTOM_NAV_ANIMATION: BottomNavAnimationConfig = {
  indicatorTransition: {
    type: 'spring',
    stiffness: 360,
    damping: 34,
  },
  iconScaleActive: 1.03,
  iconScaleInactive: 1,
  iconScaleTransition: {
    duration: 0.16,
    ease: [0.22, 1, 0.36, 1],
  },
};

const REDUCED_BOTTOM_NAV_ANIMATION: BottomNavAnimationConfig = {
  indicatorTransition: {
    duration: 0.12,
    ease: 'easeOut',
  },
  iconScaleActive: 1,
  iconScaleInactive: 1,
  iconScaleTransition: {
    duration: 0.1,
    ease: 'easeOut',
  },
};

export const getAnimationPreset = (
  name: AnimationPresetName = 'pageFadeLift',
  reduceMotion = false,
): AnimationPreset => {
  if (reduceMotion) return REDUCED_PRESET;
  return PRESETS[name] ?? PRESETS.pageFadeLift;
};

export const getBottomNavAnimation = (reduceMotion = false): BottomNavAnimationConfig => {
  if (reduceMotion) return REDUCED_BOTTOM_NAV_ANIMATION;
  return BOTTOM_NAV_ANIMATION;
};
