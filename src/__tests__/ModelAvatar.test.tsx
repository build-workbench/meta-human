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
    uncacheClip: ReturnType<typeof vi.fn>;
    clipAction: ReturnType<typeof vi.fn>;
  }> = [];
  return {
    frameHolder: {
      cb: null as
        | ((
            state: {
              clock: { elapsedTime: number };
              camera: { position: { x: number; y: number; z: number } };
            },
            delta: number,
          ) => void)
        | null,
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

function makeAction(clip?: unknown) {
  const action: Record<string, unknown> = {
    clampWhenFinished: false,
  };
  action.getClip = vi.fn(() => clip);
  action.reset = vi.fn(() => action);
  action.fadeIn = vi.fn(() => action);
  action.play = vi.fn(() => action);
  action.fadeOut = vi.fn(() => action);
  action.setLoop = vi.fn(() => action);
  return action;
}

vi.mock('three', () => ({
  MathUtils: {
    lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    clamp: (v: number, min: number, max: number) => Math.min(max, Math.max(min, v)),
  },
  LoopOnce: 'LoopOnce',
  AdditiveBlending: 'AdditiveBlending',
  AnimationMixer: class {
    update = vi.fn();
    stopAllAction = vi.fn();
    uncacheRoot = vi.fn();
    uncacheClip = vi.fn();
    clipAction = vi.fn((clip: unknown) => makeAction(clip));
    constructor() {
      mixerState.instances.push(this as never);
    }
  },
}));

// 模拟真实 useRef 的跨渲染稳定性：ModelAvatar 每次渲染固定调用 8 个 useRef
//（hooks 顺序恒定：group/gazeRef/mouthRef/storeRef/intensityRef/revealRef/actionsRef/activeActionRef），
// 按槽位持久化；槽位 0/1/2（group/gaze/mouth）由 React 提交 DOM 节点时注入并附加 3D 属性。
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const HOOKS_PER_RENDER = 8;
  const DECORATED_SLOTS = new Set([0, 1, 2]);
  return {
    ...actual,
    useRef: (initial: unknown) => {
      refState.call += 1;
      const slot = (refState.call - 1) % HOOKS_PER_RENDER;
      if (!refState.slots[slot]) {
        if (DECORATED_SLOTS.has(slot)) {
          let current: unknown = null;
          const ref: { current: unknown } = {} as { current: unknown };
          Object.defineProperty(ref, 'current', {
            get: () => current,
            set: (v: unknown) => {
              if (v && typeof v === 'object') {
                const node = v as Record<string, unknown>;
                if (!node.rotation) node.rotation = { x: 0, y: 0, z: 0 };
                if (!node.scale) node.scale = { x: 1, y: 1, z: 1 };
                if (!node.material) node.material = { opacity: 0 };
                if (!node.position) node.position = { x: 0, y: 0, z: 0, set: vi.fn() };
                if (!node.children) node.children = [];
              }
              current = v;
            },
            enumerable: true,
            configurable: true,
          });
          groupRefs.push(ref);
          refState.slots[slot] = ref;
        } else {
          refState.slots[slot] = { current: initial };
        }
      }
      return refState.slots[slot];
    },
  };
});

vi.mock('@react-three/fiber', () => ({
  useFrame: (
    cb: (
      state: {
        clock: { elapsedTime: number };
        camera: { position: { x: number; y: number; z: number } };
      },
      delta: number,
    ) => void,
  ) => {
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
    frameHolder.cb?.(
      { clock: { elapsedTime: t }, camera: { position: { x: 0, y: 0.12, z: 5.4 } } },
      delta,
    );
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
    holo: {
      time: { value: 0 },
      speech: { value: 0 },
      reveal: { value: 0 },
    },
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
      currentBehavior: 'idle',
      isSpeaking: false,
      expressionIntensity: 0.8,
    });
  });

  it('渲染不抛错并注册 useFrame，材质 uniforms 被驱动', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    expect(frameHolder.cb).toBeTypeOf('function');
    runFrame(1);
    expect(model.holo.time.value).toBe(1);
    // 入场显现扫描推进（0 → delta/1.3）
    expect(model.holo.reveal.value).toBeGreaterThan(0);
    expect(model.holo.reveal.value).toBeLessThanOrEqual(1.05);
  });

  it('说话强度平滑跟随口型信号', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    mouthOpenSignal.set(1);
    runFrame(1);
    // lerp(0, 1, 0.25) = 0.25，再一帧继续逼近
    expect(model.holo.speech.value).toBeCloseTo(0.25);
    runFrame(2);
    expect(model.holo.speech.value).toBeGreaterThan(0.25);
  });

  it('thinking 行为驱动程序化思考摆动（无需动画触发）', () => {
    const model = makeModel(); // clipMap 为空，animation 保持 idle
    useDigitalHumanStore.setState({ currentBehavior: 'thinking' });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    runFrame(1);
    const groupNode = groupRefs[0]?.current as { rotation: { x: number; z: number } };
    expect(groupNode.rotation.z).not.toBe(0);
    expect(groupNode.rotation.x).not.toBe(0);
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

  it('注视相机：内层 gaze group 朝相机方位小幅偏转', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    // 相机在 +X 侧：atan2(5.4, 0) * 0.35 ≈ 1.099，钳制到 0.5
    act(() => {
      frameHolder.cb?.(
        { clock: { elapsedTime: 1 }, camera: { position: { x: 5.4, y: 0, z: 0 } } },
        0.016,
      );
    });
    const gazeNode = groupRefs[1]?.current as { rotation: { y: number } };
    expect(gazeNode.rotation.y).toBeGreaterThan(0);
    expect(gazeNode.rotation.y).toBeLessThanOrEqual(0.5 * 0.2 + 1e-9);
  });

  it('无 jawOpen 时全息嘴覆盖层跟随口型开合', () => {
    const model = makeModel({
      faceAnchor: { x: 0, y: 0.1, z: 0.6, width: 0.5, height: 0.3 },
    });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    const mouth = groupRefs[2]?.current as {
      scale: { y: number };
      material: { opacity: number };
    };
    expect(mouth).toBeTruthy();
    // jsdom 中 JSX scale prop 不生效，手动对齐到闭合基线（height*0.3）
    mouth.scale.y = 0.09;
    mouth.material.opacity = 0.3;

    runFrame(1); // 闭嘴帧：保持闭合
    expect(mouth.scale.y).toBeCloseTo(0.09);

    mouthOpenSignal.set(1);
    runFrame(2); // 张嘴帧：纵向张开 + 变亮
    expect(mouth.scale.y).toBeGreaterThan(0.09);
    expect(mouth.material.opacity).toBeGreaterThan(0.3);
  });

  it('存在 jawOpen morph 时不渲染全息嘴覆盖层', () => {
    const mouthMesh = { morphTargetInfluences: [0] };
    const model = makeModel({
      morphs: { mouth: [{ mesh: mouthMesh as never, index: 0 }] },
      faceAnchor: { x: 0, y: 0.1, z: 0.6, width: 0.5, height: 0.3 },
    });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    // mouthRef 槽位未被 React 赋 DOM 节点（覆盖层未渲染）
    expect(groupRefs[2]?.current).toBeNull();
  });

  it('reducedMotion 且 idle 非说话时冻结动画（材质时间仍推进、显现跳过）', () => {
    const model = makeModel();
    render(<ModelAvatar model={model} prefersReducedMotion />);

    runFrame(2);
    expect(model.holo.time.value).toBe(2);
    // reduced motion 直接完全显现，不做入场扫描
    expect(model.holo.reveal.value).toBe(1.05);
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

  it('从有剪辑动作切到无剪辑动作时旧 action 仍 fadeOut', () => {
    // 修复回归点：原版 `if (!clip) return;` 早返回导致 wave→think 时
    // 旧 wave action 残留，叠加程序化旋转。
    const waveClip = { name: 'Wave' };
    const model = makeModel({
      clipMap: { wave: waveClip as never, idle: { name: 'Idle' } as never },
    });
    render(<ModelAvatar model={model} prefersReducedMotion={false} />);

    act(() => {
      useDigitalHumanStore.getState().setAnimation('wave');
    });
    const mixer = mixerState.instances[0];
    const waveAction = mixer.clipAction.mock.results.find(
      (r) => (r.value as { getClip?: () => unknown }).getClip?.() === waveClip,
    )?.value as { play: ReturnType<typeof vi.fn>; fadeOut: ReturnType<typeof vi.fn> };
    expect(waveAction.play).toHaveBeenCalled();

    act(() => {
      useDigitalHumanStore.getState().setAnimation('think'); // 无剪辑
    });

    // 旧 wave action 被 fadeOut 收尾；不创建新 action
    expect(waveAction.fadeOut).toHaveBeenCalledWith(0.2);
    // wave 之后没有再 clipAction（只在切换到有剪辑动作时才创建）
    expect(mixer.clipAction.mock.calls.length).toBe(2); // idle + wave，无 think
  });

  it('换 model.group 时新建 mixer 并完整清理旧 mixer', () => {
    // 修复回归点：同组件复用时 actionsRef 不清空导致僵尸 action。
    const idleClip = { name: 'Idle' };
    const modelA = makeModel({
      group: { name: 'groupA' } as never,
      clipMap: { idle: idleClip as never },
    });
    const { rerender } = render(<ModelAvatar model={modelA} prefersReducedMotion={false} />);
    const mixerA = mixerState.instances[0];
    // 首次 render 已创建 idle action
    const actionA = mixerA.clipAction.mock.results[0]?.value as {
      getClip: ReturnType<typeof vi.fn>;
    };
    expect(actionA).toBeTruthy();

    const modelB = makeModel({ group: { name: 'groupB' } as never });
    rerender(<ModelAvatar model={modelB} prefersReducedMotion={false} />);
    const mixerB = mixerState.instances[1];

    // 旧 mixerA 完整清理：uncacheClip（每个 action）+ stopAllAction + uncacheRoot(groupA)
    expect(mixerA.uncacheClip).toHaveBeenCalledWith(actionA.getClip());
    expect(mixerA.stopAllAction).toHaveBeenCalled();
    expect(mixerA.uncacheRoot).toHaveBeenCalledWith(modelA.group);
    // 新 mixerB 已就绪
    expect(mixerB).toBeTruthy();
    expect(mixerB).not.toBe(mixerA);
  });
});
