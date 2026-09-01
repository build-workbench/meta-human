import type { BehaviorType } from './avatarContract';

/**
 * 内置 3D 头像模型（RobotExpressive.glb，CC0：Tomás Laulhé / Don McCurdy 修改）。
 * GitHub Pages 部署在子路径 /meta-human/，必须用 import.meta.env.BASE_URL 拼 URL，
 * 硬编码 /models/... 会在 Pages 上 404。
 */
export const DEFAULT_AVATAR_MODEL_URL = `${import.meta.env.BASE_URL}models/RobotExpressive.glb`;

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
