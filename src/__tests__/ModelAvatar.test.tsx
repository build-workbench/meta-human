/**
 * ModelAvatar 冒烟与 useFrame 行为测试。
 *
 * 手法与 CyberAvatar.test 一致：useFrame 回调捕获后手动驱动；
 * group ref 通过带 setter 的 proxy 注入（React 提交 DOM 节点时附加
 * rotation/scale）。three 局部 mock：AnimationMixer 记录实例便于断言
 * update/stopAllAction/uncacheRoot。
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { ModelAvatar } from '@/components/viewer/ModelAvatar';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import type { PreparedAvatarModel } from '@/core/avatar/avatarModelPrepare';

const { frameHolder, visibility, mixerState, groupRefs, refState } = vi.hoisted(() => {
  const instances: Array<{
    update: ReturnType<typeof vi.fn>;
    stopAllAction: ReturnType<typeof vi.fn>;
    uncacheRoot: ReturnType<typeof vi.fn>;
    clipAction: ReturnType<typeof vi.fn>;
  }> = [];
  return {
    frameHolder: {
      cb: null as ((state: { clock: { elapsedTime: number } }, delta: number) => void) | null,
    },
    visibility: { current: true },
    mixerState: {
      get instances() {
        return instances;
      },
    },
    groupRefs: [] as Array<{ current: unknown }>,
    refState: {
      call: 0,
      slots: [] as Array<{ current: unknown }>,
    },
  };
});

function makeAction() {
  const action: Record<string, unknown> = {
    clampWhenFinished: false,
  };
  action.reset = vi.fn(() => action);
  action.fadeIn = vi.fn(() => action);
  action.play = vi.fn(() => action);
  action.fadeOut = vi.fn(() => action);
  action.setLoop = vi.fn(() => action);
  return action;
}

vi.mock('three', () => ({
  MathUtils: { lerp: (a: number, b: number, t: number) => a + (b - a) * t },
  LoopOnce: 'LoopOnce',
  AnimationMixer: class {
    update = vi.fn();
    stopAllAction = vi.fn();
    uncacheRoot = vi.fn();
    clipAction = vi.fn(() => makeAction());
    constructor() {
      mixerState.instances.push(this as never);
    }
  },
}));

// 模拟真实 useRef 的跨渲染稳定性：ModelAvatar 每次渲染固定调用 5 个 useRef
//（hooks 顺序恒定：group/storeRef/intensityRef/actionsRef/activeActionRef），
// 按槽位持久化；槽位 0（group）由 React 提交 DOM 节点时注入并附加 3D 属性。
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const HOOKS_PER_RENDER = 5;
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
          groupRefs.push(ref);
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

vi.mock('@react-three/drei', () => ({
  Float: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks', () => ({
  useIsTabVisibleRef: () => visibility,
}));

function runFrame(t = 1, delta = 0.016): void {
  act(() => {
    frameHolder.cb?.({ clock: { elapsedTime: t } }, delta);
  });
}

const originalConsoleError = console.error;
beforeAll(() => {
  vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('is using incorrect casing')) return;
    originalConsoleError(...args);
  });
});

function makeModel(overrides: Partial<PreparedAvatarModel> = {}): PreparedAvatarModel {
  return {
    group: { name: 'fake-root' },
    morphs: {},
    clipMap: {},
    timeUniform: { value: 0 },
    ...overrides,
  } as PreparedAvatarModel;
}

describe('ModelAvatar', () => {
  beforeEach(() => {
    frameHolder.cb = null;
    visibility.current = true;
    groupRefs.length = 0;
    refState.call = 0;
    refState.slots.length = 0;
    mixerState.instances.length = 0;
    mouthOpenSignal.reset();
    useDigitalHumanStore.setState({
      currentAnimation: 'idle',
      currentExpression: 'neutral',
      isSpeaking: false,
      expressionIntensity: 0.8,
    });
  });

  it('渲染不抛错并注册 useFrame，时间 uniform 持续推进', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    expect(frameHolder.cb).toBeTypeOf('function');
    runFrame(1);
    expect(model.timeUniform.value).toBe(1);
  });

  it('存在剪辑的动作播放对应 clip 并交叉淡化', () => {
    const idleClip = { name: 'Idle' };
    const nodClip = { name: 'Yes' };
    const model = makeModel({ clipMap: { idle: idleClip as never, nod: nodClip as never } });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    const mixer = mixerState.instances[0];
    expect(mixer.clipAction).toHaveBeenCalledWith(idleClip);
    const idleAction = mixer.clipAction.mock.results[0]?.value as {
      play: ReturnType<typeof vi.fn>;
      fadeOut: ReturnType<typeof vi.fn>;
      setLoop: ReturnType<typeof vi.fn>;
    };
    expect(idleAction.play).toHaveBeenCalled();
    // 非 idle 剪辑一次性播放
    expect(idleAction.setLoop).not.toHaveBeenCalled();

    act(() => {
      useDigitalHumanStore.getState().setAnimation('nod');
    });

    expect(mixer.clipAction).toHaveBeenCalledWith(nodClip);
    expect(idleAction.fadeOut).toHaveBeenCalledWith(0.2);
    const nodAction = mixer.clipAction.mock.results[1]?.value as {
      play: ReturnType<typeof vi.fn>;
      setLoop: ReturnType<typeof vi.fn>;
    };
    expect(nodAction.play).toHaveBeenCalled();
    expect(nodAction.setLoop).toHaveBeenCalledWith('LoopOnce', 1);
  });

  it('angry 表情按 intensity 驱动对应 morph 通道', () => {
    const mesh = { morphTargetInfluences: [0] };
    const model = makeModel({ morphs: { angry: [{ mesh: mesh as never, index: 0 }] } });
    useDigitalHumanStore.setState({ currentExpression: 'angry' });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    runFrame(1);
    // lerp(0, 0.8, 0.2) = 0.16
    expect(mesh.morphTargetInfluences[0]).toBeCloseTo(0.16);
  });

  it('无 jawOpen 时口型降级写 surprise 通道 × 0.3 上限', () => {
    const surpriseMesh = { morphTargetInfluences: [0] };
    const model = makeModel({
      morphs: { surprise: [{ mesh: surpriseMesh as never, index: 0 }] },
    });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    mouthOpenSignal.set(1);
    runFrame(1);
    // lerp(0, 1 * 0.3, 0.2) = 0.06
    expect(surpriseMesh.morphTargetInfluences[0]).toBeCloseTo(0.06);
  });

  it('存在 mouth 通道时口型直接驱动，不再借用 surprise', () => {
    const mouthMesh = { morphTargetInfluences: [0] };
    const surpriseMesh = { morphTargetInfluences: [0] };
    const model = makeModel({
      morphs: {
        mouth: [{ mesh: mouthMesh as never, index: 0 }],
        surprise: [{ mesh: surpriseMesh as never, index: 0 }],
      },
    });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    mouthOpenSignal.set(1);
    runFrame(1);
    expect(mouthMesh.morphTargetInfluences[0]).toBeCloseTo(0.2);
    expect(surpriseMesh.morphTargetInfluences[0]).toBe(0);
  });

  it('think 无剪辑时降级为程序化整体旋转', () => {
    const model = makeModel(); // clipMap 为空
    useDigitalHumanStore.setState({ currentAnimation: 'think' });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    runFrame(1);
    const groupNode = groupRefs[0]?.current as { rotation: { x: number; z: number } };
    expect(groupNode.rotation.z).not.toBe(0);
    expect(groupNode.rotation.x).not.toBe(0);
  });

  it('reducedMotion 且 idle 非说话时冻结动画（材质时间仍推进）', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion />);

    runFrame(2);
    expect(model.timeUniform.value).toBe(2);
    expect(mixerState.instances[0]?.update).not.toHaveBeenCalled();
  });

  it('卸载时清理 mixer', () => {
    const model = makeModel();
    const { unmount } = render(<ModelAvatar model={model} prefersReducedMotion={false} />);
    const mixer = mixerState.instances[0];

    unmount();

    expect(mixer.stopAllAction).toHaveBeenCalled();
    expect(mixer.uncacheRoot).toHaveBeenCalledWith(model.group);
  });
});
