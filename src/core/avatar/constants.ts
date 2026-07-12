import { ACTION_TO_BEHAVIOR, type BehaviorType } from './avatarContract';

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

export const ANIMATION_TO_BEHAVIOR: Record<string, BehaviorType> = {
  wave: ACTION_TO_BEHAVIOR.wave ?? 'greeting',
  greet: ACTION_TO_BEHAVIOR.greet ?? 'greeting',
  nod: ACTION_TO_BEHAVIOR.nod ?? 'listening',
  shakeHead: ACTION_TO_BEHAVIOR.shakeHead ?? 'idle',
  dance: ACTION_TO_BEHAVIOR.dance ?? 'excited',
  think: ACTION_TO_BEHAVIOR.think ?? 'thinking',
  speak: ACTION_TO_BEHAVIOR.speak ?? 'speaking',
};
