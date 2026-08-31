/**
 * TTS 默认配置（无依赖叶子常量）。
 *
 * audioService 构造器 / prepareUtterance 与 digitalHumanStore.speechConfig
 * 统一引用此处，避免默认值散落多处导致漂移。
 */
export const DEFAULT_TTS_CONFIG = {
  lang: 'zh-CN',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
} as const;
