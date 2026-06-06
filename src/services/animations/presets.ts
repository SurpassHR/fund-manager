import type { TargetAndTransition, Transition } from 'framer-motion';

export type AnimationPresetName = 'pageFadeLift' | 'sectionFadeLift';

export interface AnimationPreset {
  initial: TargetAndTransition;
  animate: TargetAndTransition;
  exit: TargetAndTransition;
  transition: Transition;
}

export interface BottomNavAnimationConfig {
  lerp: number;
  fillColor: string;
  borderColor: string;
  insetX: number;
  insetY: number;
  borderRadius: number;
}

const REDUCED_TRANSITION: Transition = {
  duration: 0.08,
  ease: 'easeOut',
};

const REDUCED_PRESET: AnimationPreset = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: REDUCED_TRANSITION,
};

// GPU 优化：缩短 transition duration，减少每帧合成时间
const PRESETS: Record<AnimationPresetName, AnimationPreset> = {
  pageFadeLift: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
    transition: {
      duration: 0.15,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  sectionFadeLift: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: {
      duration: 0.12,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const BOTTOM_NAV_ANIMATION: BottomNavAnimationConfig = {
  lerp: 0.12,
  fillColor: 'rgba(59, 130, 246, 0.1)',
  borderColor: 'rgba(59, 130, 246, 0.2)',
  insetX: 8,
  insetY: 8,
  borderRadius: 12,
};

const REDUCED_BOTTOM_NAV_ANIMATION: BottomNavAnimationConfig = {
  lerp: 1.0,
  fillColor: 'rgba(59, 130, 246, 0.1)',
  borderColor: 'rgba(59, 130, 246, 0.2)',
  insetX: 8,
  insetY: 8,
  borderRadius: 12,
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
