/**
 * KeyboardControls 冒烟与行为测试。
 *
 * 键盘控制是纯逻辑 + DOM 事件，直接注入 mock 相机与 cameraControls，
 * 验证按键 → 相机操作函数的映射、输入框/不可见标签页的守卫、卸载清理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { KeyboardControls } from '@/components/viewer/KeyboardControls';
import {
  rotateCameraHorizontal,
  resetCameraPosition,
  moveCameraVertical,
  zoomCamera,
} from '@/components/viewer/cameraControls';

const { visibility } = vi.hoisted(() => ({
  visibility: { current: true },
}));

const camera = {
  position: { x: 0, y: 0, z: 0 },
  lookAt: vi.fn(),
};

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ camera }),
}));

vi.mock('@/hooks', () => ({
  useIsTabVisibleRef: () => visibility,
}));

vi.mock('@/components/viewer/cameraControls', () => ({
  rotateCameraHorizontal: vi.fn(),
  resetCameraPosition: vi.fn(),
  moveCameraVertical: vi.fn(),
  zoomCamera: vi.fn(),
}));

describe('KeyboardControls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    visibility.current = true;
  });

  it('左右方向键旋转相机', () => {
    render(<KeyboardControls />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(rotateCameraHorizontal).toHaveBeenCalledWith(camera, 0.1);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(rotateCameraHorizontal).toHaveBeenCalledWith(camera, -0.1);
  });

  it('上下方向键垂直移动相机', () => {
    render(<KeyboardControls />);
    fireEvent.keyDown(window, { key: 'ArrowUp' });
    expect(moveCameraVertical).toHaveBeenCalledWith(camera, 0.5);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(moveCameraVertical).toHaveBeenCalledWith(camera, -0.5);
  });

  it('加减键缩放相机（含 = 与 _ 变体）', () => {
    render(<KeyboardControls />);
    fireEvent.keyDown(window, { key: '+' });
    expect(zoomCamera).toHaveBeenCalledWith(camera, 0.9);
    fireEvent.keyDown(window, { key: '-' });
    expect(zoomCamera).toHaveBeenCalledWith(camera, 1.1);
    fireEvent.keyDown(window, { key: '=' });
    expect(zoomCamera).toHaveBeenCalledWith(camera, 0.9);
    fireEvent.keyDown(window, { key: '_' });
    expect(zoomCamera).toHaveBeenCalledWith(camera, 1.1);
  });

  it('R 键重置相机（大小写均可）', () => {
    render(<KeyboardControls />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(resetCameraPosition).toHaveBeenCalledWith(camera);
    fireEvent.keyDown(window, { key: 'R' });
    expect(resetCameraPosition).toHaveBeenCalledTimes(2);
  });

  it('输入框内按键不触发相机操作', () => {
    render(<KeyboardControls />);
    const input = document.createElement('input');
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(rotateCameraHorizontal).not.toHaveBeenCalled();
  });

  it('标签页不可见时不触发相机操作', () => {
    visibility.current = false;
    render(<KeyboardControls />);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(rotateCameraHorizontal).not.toHaveBeenCalled();
  });

  it('卸载后移除全局键盘监听', () => {
    const { unmount } = render(<KeyboardControls />);
    unmount();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(rotateCameraHorizontal).not.toHaveBeenCalled();
  });
});
