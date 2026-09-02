/**
 * DigitalHumanViewer 性能与可见性配置测试。
 *
 * 验证：
 * 1. `<Canvas>` 接收 `shadows="percentage"`（消除 PCFSoft 弃用警告）
 * 2. DPR 上限由 2 降至 1.5（高分屏像素量减少约 44%）
 * 3. `frameloop` 随标签页可见性切换 'always' ↔ 'never'
 * 4. 无 modelUrl 时回落到程序化 cyber avatar（不加载 GLTFLoader）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import DigitalHumanViewer from '@/components/viewer/DigitalHumanViewer';

const { canvasProps, loaderCalls } = vi.hoisted(() => ({
  canvasProps: { current: null as Record<string, unknown> | null },
  loaderCalls: { count: 0 },
}));

let visibilityState: 'visible' | 'hidden' = 'visible';

function dispatchVisibility() {
  document.dispatchEvent(new Event('visibilitychange'));
}

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: Record<string, unknown>) => {
    canvasProps.current = props;
    return <div data-testid="canvas">{props.children as React.ReactNode}</div>;
  },
}));

vi.mock('@react-three/drei', () => ({
  Html: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/viewer/Scene', () => ({
  Scene: () => <div data-testid="scene" />,
}));

vi.mock('@/core/avatar/avatarModelPrepare', () => ({
  prepareAvatarModel: vi.fn(() => ({
    group: { name: 'mock-prepared' },
    morphs: {},
    clipMap: {},
    holo: { time: { value: 0 }, speech: { value: 0 }, reveal: { value: 0 } },
  })),
}));

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load = vi.fn(() => {
      loaderCalls.count += 1;
    });
  },
}));

describe('DigitalHumanViewer', () => {
  beforeEach(() => {
    canvasProps.current = null;
    loaderCalls.count = 0;
    visibilityState = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
  });

  it('Canvas 配置：shadows=percentage / dpr=[1,1.5] / frameloop 跟随可见性', () => {
    render(<DigitalHumanViewer />);

    expect(canvasProps.current).toBeTruthy();
    expect(canvasProps.current?.shadows).toBe('percentage');
    expect(canvasProps.current?.dpr).toEqual([1, 1.5]);
    expect(canvasProps.current?.frameloop).toBe('always');
  });

  it('标签页隐藏时 frameloop 切到 never，恢复时切回 always', () => {
    render(<DigitalHumanViewer />);

    act(() => {
      visibilityState = 'hidden';
      dispatchVisibility();
    });
    expect(canvasProps.current?.frameloop).toBe('never');

    act(() => {
      visibilityState = 'visible';
      dispatchVisibility();
    });
    expect(canvasProps.current?.frameloop).toBe('always');
  });

  it('无 modelUrl 时不调用 GLTFLoader 且标记 procedural-cyber-avatar', () => {
    const onModelLoad = vi.fn();
    render(<DigitalHumanViewer onModelLoad={onModelLoad} />);

    expect(loaderCalls.count).toBe(0);
    expect(onModelLoad).toHaveBeenCalledWith({ type: 'procedural-cyber-avatar' });
  });
});
