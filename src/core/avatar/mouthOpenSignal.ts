/**
 * Lipsync 嘴型开合信号（0=闭嘴，1=张大）。
 *
 * TTS viseme 循环以约 16fps 驱动该值。这类高频渲染数据不走 React 状态层：
 * 写入 Zustand 会触发全量订阅检查，且任何常规 useStore 订阅都会高频重渲染。
 * 渲染组件（CyberAvatar）在 useFrame 中直读 value，每帧一次，零订阅开销。
 */
export const mouthOpenSignal = {
  value: 0,
  set(open: number): void {
    this.value = Math.max(0, Math.min(1, open));
  },
  reset(): void {
    this.value = 0;
  },
};
