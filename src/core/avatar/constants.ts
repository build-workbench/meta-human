import type { BehaviorType } from './avatarContract';

export const ANIMATION_DURATIONS: Record<string, number> = {
  wave: 3000,
  greet: 3000,
  nod: 2000,
  shakeHead: 2000,
  dance: 6000,
  think: 3000,
  speak: 0,
  idle: 0,
};

/** 动作 → 行为映射（单一数据源，avatarContract 不再维护第二份）。 */
export const ANIMATION_TO_BEHAVIOR: Record<string, BehaviorType> = {
  wave: 'greeting',
  greet: 'greeting',
  nod: 'listening',
  shakeHead: 'idle',
  dance: 'excited',
  think: 'thinking',
  speak: 'speaking',
};
