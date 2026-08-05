import { describe, expect, it, vi } from 'vitest';
import type * as THREE from 'three';
import { zoomCamera } from '@/components/viewer/cameraControls';

/** 构造一个只含距离信息的假相机，避免依赖真实 three 实例。 */
function createCamera(initialDistance: number) {
  let len = initialDistance;
  const position = {
    length: () => len,
    setLength: vi.fn((next: number) => {
      len = next;
    }),
    multiplyScalar: vi.fn((factor: number) => {
      len *= factor;
    }),
  };
  return { position } as unknown as THREE.Camera;
}

describe('zoomCamera', () => {
  it('scales distance normally within range', () => {
    const camera = createCamera(6);

    zoomCamera(camera, 0.9);

    expect(camera.position.length()).toBeCloseTo(5.4);
  });

  it('clamps to the minimum distance when zooming in past it', () => {
    const camera = createCamera(4);

    zoomCamera(camera, 0.1); // 0.4，低于 OrbitControls minDistance=3

    expect(camera.position.length()).toBe(3);
  });

  it('clamps to the maximum distance when zooming out past it', () => {
    const camera = createCamera(8);

    zoomCamera(camera, 5); // 40，高于 OrbitControls maxDistance=10

    expect(camera.position.length()).toBe(10);
  });
});
