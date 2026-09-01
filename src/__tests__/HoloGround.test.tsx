/**
 * HoloGround 行为测试。
 *
 * 与 ModelAvatar.test 同一套手法：useFrame 回调捕获后手动驱动，
 * useRef 按槽位持久化（pingRef/storeRef/phaseRef），ping 网格的
 * DOM 节点注入 material.opacity 与 scale.setScalar。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { HoloGround } from '@/components/viewer/HoloGround';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

const { frameHolder, visibility, pingRefs, refState } = vi.hoisted(() => ({
  frameHolder: {
    cb: null as ((state: { clock: { elapsedTime: number } }, delta: number) => void) | null,
  },
  visibility: { current: true },
  pingRefs: [] as Array<{ current: unknown }>,
  refState: {
    call: 0,
    slots: [] as Array<{ current: unknown }>,
  },
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const HOOKS_PER_RENDER = 3; // pingRef / storeRef / phaseRef
  return {
    ...actual,
    useRef: (initial: unknown) => {
      refState.call += 1;
      const slot = (refState.call - 1) % HOOKS_PER_RENDER;
      if (!refState.slots[slot]) {
        if (slot === 0) {
          let current: unknown = null;
          const ref: { current: unknown } = {} as { current: unknown };
          Object.defineProperty(ref, 'current', {
            get: () => current,
            set: (v: unknown) => {
              if (v && typeof v === 'object') {
                const node = v as Record<string, unknown>;
                if (!node.material) node.material = { opacity: 0 };
                if (!node.scale) node.scale = { setScalar: vi.fn() };
              }
              current = v;
            },
            enumerable: true,
            configurable: true,
          });
          pingRefs.push(ref);
          refState.slots[0] = ref;
        } else {
          refState.slots[slot] = { current: initial };
        }
      }
      return refState.slots[slot];
    },
  };
});

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: { clock: { elapsedTime: number } }, delta: number) => void) => {
    frameHolder.cb = cb;
  },
}));

vi.mock('@/hooks', () => ({
  useIsTabVisibleRef: () => visibility,
}));

function runFrame(t = 1, delta = 0.2): void {
  act(() => {
    frameHolder.cb?.({ clock: { elapsedTime: t } }, delta);
  });
}

function pingNode() {
  return pingRefs[0]?.current as {
    material: { opacity: number };
    scale: { setScalar: ReturnType<typeof vi.fn> };
  };
}

describe('HoloGround', () => {
  beforeEach(() => {
    frameHolder.cb = null;
    visibility.current = true;
    pingRefs.length = 0;
    refState.call = 0;
    refState.slots.length = 0;
    mouthOpenSignal.reset();
    useDigitalHumanStore.setState({ isSpeaking: false });
  });

  it('渲染不抛错并注册 useFrame', () => {
    render(<HoloGround prefersReducedMotion={false} />);
    expect(frameHolder.cb).toBeTypeOf('function');
  });

  it('说话时声呐脉冲向外扩散，强度跟随口型', () => {
    useDigitalHumanStore.setState({ isSpeaking: true });
    render(<HoloGround prefersReducedMotion={false} />);

    mouthOpenSignal.set(1);
    runFrame(1, 0.6); // 半个脉冲周期
    const node = pingNode();
    const halfOpacity = node.material.opacity;
    expect(node.scale.setScalar).toHaveBeenCalled();
    // 半程：(1-0.5) * (0.18 + 0.4*1) = 0.29
    expect(halfOpacity).toBeCloseTo(0.29);

    runFrame(2, 0.01); // 相位推进但未回绕，透明度继续衰减
    expect(node.material.opacity).toBeLessThan(halfOpacity);
  });

  it('静止时保持呼吸微脉（opacity > 0）', () => {
    render(<HoloGround prefersReducedMotion={false} />);
    runFrame(1);
    expect(pingNode().material.opacity).toBeGreaterThan(0);
  });

  it('reduced motion 时脉冲完全隐藏', () => {
    useDigitalHumanStore.setState({ isSpeaking: true });
    render(<HoloGround prefersReducedMotion />);
    mouthOpenSignal.set(1);
    runFrame(1);
    expect(pingNode().material.opacity).toBe(0);
  });
});
