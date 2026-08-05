/**
 * 相机控制工具函数。
 *
 * 纯函数，可独立测试。
 */

import * as THREE from 'three';

/**
 * 围绕 Y 轴旋转相机。
 */
export function rotateCameraHorizontal(camera: THREE.Camera, angle: number): void {
  const x = camera.position.x * Math.cos(angle) - camera.position.z * Math.sin(angle);
  const z = camera.position.x * Math.sin(angle) + camera.position.z * Math.cos(angle);
  camera.position.x = x;
  camera.position.z = z;
  camera.lookAt(0, 0, 0);
}

/**
 * 重置相机到默认位置。
 */
export function resetCameraPosition(camera: THREE.Camera): void {
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
}

/**
 * 垂直移动相机（限制范围）。
 */
export function moveCameraVertical(camera: THREE.Camera, delta: number, min = -2, max = 4): void {
  camera.position.y = Math.max(min, Math.min(max, camera.position.y + delta));
  camera.lookAt(0, 0, 0);
}

/**
 * 缩放相机距离。
 *
 * 距离钳制在 OrbitControls 的 minDistance/maxDistance 范围内，
 * 避免键盘缩放越界后与轨道控制器的下一次交互产生位置跳变。
 */
export function zoomCamera(camera: THREE.Camera, factor: number, min = 3, max = 10): void {
  const next = Math.max(min, Math.min(max, camera.position.length() * factor));
  camera.position.setLength(next);
}
