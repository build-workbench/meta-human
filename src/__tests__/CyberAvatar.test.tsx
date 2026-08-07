/**
 * CyberAvatar 冒烟与 useFrame 行为测试。
 *
 * useFrame 回调被捕获后手动驱动；mesh/group 的 ref 通过带 setter 的
 * proxy 注入，React 提交时把 DOM 节点赋给 ref.current 并附加 3D 属性，
 * 使嘴型跟随、表情、动画逻辑可被真实执行与断言。
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { CyberAvatar } from '@/components/viewer/CyberAvatar';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

// ref 注入状态与 react.useRef 的包装逻辑（vi.mock 工厂内不可引用外部变量，故放入 vi.hoisted）
const { frameHolder, visibility, meshState } = vi.hoisted(() => {
  const meshRefs: Array<{ current: unknown }> = [];
  let refCall = 0;

  function next(initial: unknown): { current: unknown } {
    if (refCall < 6) {
      refCall += 1;
      let current: unknown = null;
      const ref: { current: unknown } = {} as { current: unknown };
      Object.defineProperty(ref, 'current', {
        get: () => current,
        set: (v: unknown) => {
          if (v && typeof v === 'object') {
            const node = v as Record<string, unknown>;
            if (!node.rotation) node.rotation = { x: 0, y: 0, z: 0 };
            if (!node.scale) node.scale = { x: 1, y: 1, z: 1 };
            if (!node.position) node.position = { x: 0, y: 0, z: 0, set: vi.fn() };
            if (!node.children) node.children = [];
          }
          current = v;
        },
        enumerable: true,
        configurable: true,
      });
      meshRefs.push(ref);
      return ref;
    }
    refCall += 1;
    return { current: initial };
  }

  return {
    frameHolder: { cb: null as ((state: { clock: { elapsedTime: number } }) => void) | null },
    visibility: { current: true },
    meshState: {
      get meshRefs(): Array<{ current: unknown }> {
        return meshRefs;
      },
      reset() {
        refCall = 0;
        meshRefs.length = 0;
      },
      next,
    },
  };
});

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: (initial: unknown) => meshState.next(initial),
  };
});

vi.mock('@react-three/fiber', () => ({
  useFrame: (cb: (state: { clock: { elapsedTime: number } }) => void) => {
    frameHolder.cb = cb;
  },
}));

vi.mock('@react-three/drei', () => ({
  Float: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks', () => ({
  useIsTabVisibleRef: () => visibility,
}));

vi.mock('three', () => ({
  MathUtils: { lerp: (a: number, b: number, t: number) => a + (b - a) * t },
  DoubleSide: 'DoubleSide',
  BoxGeometry: vi.fn(),
  SphereGeometry: vi.fn(),
  CapsuleGeometry: vi.fn(),
  CylinderGeometry: vi.fn(),
  TorusGeometry: vi.fn(),
  MeshPhysicalMaterial: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  MeshBasicMaterial: vi.fn(),
}));

function runFrame(t = 1): void {
  act(() => {
    frameHolder.cb?.({ clock: { elapsedTime: t } });
  });
}

// R3F 小写元素（<mesh> 等）在 jsdom 中是无害的 host 元素，React 会打印 casing 警告；
// 过滤这类噪音，保留其他真实错误输出。
const originalConsoleError = console.error;
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('is using incorrect casing')) return;
    originalConsoleError(...args);
  });
});

describe('CyberAvatar', () => {
  beforeEach(() => {
    meshState.reset();
    frameHolder.cb = null;
    visibility.current = true;
    mouthOpenSignal.reset();
    useDigitalHumanStore.setState({
      currentAnimation: 'idle',
      currentExpression: 'neutral',
      isSpeaking: false,
      expressionIntensity: 0.8,
    });
  });

  it('渲染不抛错并注册 useFrame 回调', () => {
    render(<CyberAvatar prefersReducedMotion={false} />);
    expect(frameHolder.cb).toBeTypeOf('function');
    expect(meshState.meshRefs.length).toBeGreaterThanOrEqual(6);
  });

  it('嘴型开合跟随 mouthOpenSignal', () => {
    render(<CyberAvatar prefersReducedMotion={false} />);
    const mouth = meshState.meshRefs[5];
    const mouthNode = mouth.current as { scale: { x: number; y: number } };

    // 闭嘴帧：mouthOpen=0 → scale.y 向 0.15 收敛
    runFrame(1);
    const closedY = mouthNode.scale.y;
    expect(closedY).toBeLessThan(1);

    // 张嘴帧：mouthOpen=1 → scale.y 增大
    mouthOpenSignal.set(1);
    runFrame(2);
    expect(mouthNode.scale.y).toBeGreaterThan(closedY);
    expect(mouthNode.scale.y).toBeLessThan(1);
  });

  it('smile 表情驱动眼睛纵向收缩', () => {
    render(<CyberAvatar prefersReducedMotion={false} />);
    const leftEye = meshState.meshRefs[2];
    const leftEyeNode = leftEye.current as { scale: { y: number } };

    runFrame(1);
    const neutralY = leftEyeNode.scale.y;

    act(() => {
      useDigitalHumanStore.getState().setExpression('smile');
    });
    runFrame(2);
    expect(leftEyeNode.scale.y).toBeLessThan(neutralY);
  });

  it('说话时头部产生摆动', () => {
    render(<CyberAvatar prefersReducedMotion={false} />);
    const head = meshState.meshRefs[1];
    const headNode = head.current as { rotation: { x: number } };

    act(() => {
      useDigitalHumanStore.getState().setSpeaking(true);
    });
    runFrame(1);
    expect(headNode.rotation.x).not.toBe(0);
  });

  it('nod 动画驱动头部旋转', () => {
    render(<CyberAvatar prefersReducedMotion={false} />);
    const group = meshState.meshRefs[0];
    const groupNode = group.current as { rotation: { x: number } };

    act(() => {
      useDigitalHumanStore.getState().setAnimation('nod');
    });
    runFrame(1);
    expect(groupNode.rotation.x).not.toBe(0);
  });

  it('reducedMotion 且 idle 非说话时跳过动画', () => {
    render(<CyberAvatar prefersReducedMotion />);
    const group = meshState.meshRefs[0];
    const groupNode = group.current as { rotation: { x: number } };

    runFrame(1);
    expect(groupNode.rotation.x).toBe(0);
  });
});
