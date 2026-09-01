/**
 * avatarModelPrepare 单元测试。
 *
 * three 在本文件内局部 mock（覆盖 setup.ts 的全局替身）：
 * Box3 读取 hoisted 的 boxState，便于按用例控制包围盒尺寸/中心；
 * Material/Group/Vector3/Color 为最小桩。验证归一化、全息材质覆盖、
 * morph 候选名探测与剪辑解析的降级行为。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const boxState = vi.hoisted(() => ({
  size: { x: 1, y: 4.8, z: 1 },
  center: { x: 0.1, y: 2.4, z: -0.05 },
}));

vi.mock('three', () => {
  class Material {
    dispose = vi.fn();
  }
  return {
    Material,
    Color: class {
      constructor(public hex: string) {}
    },
    Vector3: class {
      x = 0;
      y = 0;
      z = 0;
    },
    Group: class {
      children: unknown[] = [];
      add = vi.fn();
    },
    Box3: class {
      setFromObject = vi.fn(() => this);
      getSize(target: { x: number; y: number; z: number }) {
        Object.assign(target, boxState.size);
        return target;
      }
      getCenter(target: { x: number; y: number; z: number }) {
        Object.assign(target, boxState.center);
        return target;
      }
    },
    MeshStandardMaterial: class {
      constructor(opts: Record<string, unknown>) {
        Object.assign(this, opts);
      }
      dispose = vi.fn();
    },
  };
});

import * as THREE from 'three';
import {
  createHologramMaterial,
  prepareAvatarModel,
  CENTER_Y,
  TARGET_HEIGHT,
} from '@/core/avatar/avatarModelPrepare';

interface FakeMesh {
  isMesh: boolean;
  material: unknown;
  morphTargetDictionary?: Record<string, number>;
  morphTargetInfluences?: number[];
}

function makeScene(meshes: FakeMesh[], nonMeshes: unknown[] = []) {
  const scene = {
    scale: { setScalar: vi.fn() },
    position: { set: vi.fn() },
    traverse: vi.fn((cb: (child: unknown) => void) => {
      [...meshes, ...nonMeshes].forEach(cb);
    }),
  };
  return scene;
}

function makeClip(name: string) {
  return { name } as THREE.AnimationClip;
}

describe('createHologramMaterial', () => {
  it('注入 Fresnel/扫描线 shader 并共享 uTime uniform', () => {
    const timeUniform = { value: 0 };
    const material = createHologramMaterial(timeUniform);
    const shader = {
      uniforms: {} as Record<string, unknown>,
      vertexShader: '#include <common>\n#include <skinning_vertex>\n',
      fragmentShader: '#include <common>\n#include <emissivemap_fragment>\n',
    };

    material.onBeforeCompile(shader as never, {} as never);

    expect(shader.uniforms.uTime).toBe(timeUniform);
    expect(shader.vertexShader).toContain('vHoloPos = (modelMatrix * vec4(transformed, 1.0)).xyz');
    expect(shader.fragmentShader).toContain('holoFresnel');
    expect(shader.fragmentShader).toContain('holoScan');
  });
});

describe('prepareAvatarModel', () => {
  beforeEach(() => {
    boxState.size = { x: 1, y: 4.8, z: 1 };
    boxState.center = { x: 0.1, y: 2.4, z: -0.05 };
  });

  it('归一化缩放到 TARGET_HEIGHT 并把包围盒中心平移到 (0, CENTER_Y, 0)', () => {
    const scene = makeScene([]);
    const prepared = prepareAvatarModel(scene as never, []);

    // scale = 2.4 / 4.8 = 0.5；position = -center*scale 与 CENTER_Y - center.y*scale
    expect(scene.scale.setScalar).toHaveBeenCalledWith(TARGET_HEIGHT / 4.8);
    expect(scene.position.set).toHaveBeenCalledWith(-0.1 * 0.5, CENTER_Y - 2.4 * 0.5, 0.05 * 0.5);
    expect(prepared.group.add).toHaveBeenCalledWith(scene);
  });

  it('零高度模型不缩放（降级为 scale 1）', () => {
    boxState.size = { x: 0, y: 0, z: 0 };
    const scene = makeScene([]);

    prepareAvatarModel(scene as never, []);

    expect(scene.scale.setScalar).toHaveBeenCalledWith(1);
  });

  it('替换全部材质为共享全息材质并释放旧材质（共享实例只释放一次）', () => {
    const sharedOld = new THREE.Material();
    const uniqueOld = new THREE.Material();
    const head: FakeMesh = { isMesh: true, material: sharedOld };
    const body: FakeMesh = { isMesh: true, material: [sharedOld, uniqueOld] };

    const prepared = prepareAvatarModel(makeScene([head, body]) as never, []);

    expect(sharedOld.dispose).toHaveBeenCalledTimes(1);
    expect(uniqueOld.dispose).toHaveBeenCalledTimes(1);
    const holo = head.material;
    expect(holo).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(body.material).toBe(holo);
    expect(prepared.timeUniform).toEqual({ value: 0 });
  });

  it('按候选名探测 morph 通道，缺失通道不产生绑定', () => {
    const head: FakeMesh = {
      isMesh: true,
      material: new THREE.Material(),
      morphTargetDictionary: { Angry: 0, Surprised: 1, Sad: 2 },
      morphTargetInfluences: [0, 0, 0],
    };
    const jaw: FakeMesh = {
      isMesh: true,
      material: new THREE.Material(),
      morphTargetDictionary: { MouthOpen: 0 },
      morphTargetInfluences: [0],
    };
    const plain: FakeMesh = { isMesh: true, material: new THREE.Material() };

    const prepared = prepareAvatarModel(
      makeScene([head, jaw, plain], [{ isMesh: false }]) as never,
      [],
    );

    expect(prepared.morphs.angry).toEqual([{ mesh: head, index: 0 }]);
    expect(prepared.morphs.surprise).toEqual([{ mesh: head, index: 1 }]);
    expect(prepared.morphs.sad).toEqual([{ mesh: head, index: 2 }]);
    expect(prepared.morphs.mouth).toEqual([{ mesh: jaw, index: 0 }]);
    // 模型没有 smile/laugh → 降级信号
    expect(prepared.morphs.smile).toBeUndefined();
    expect(prepared.morphs.laugh).toBeUndefined();
  });

  it('解析存在的动画剪辑，缺失动作缺席（think/speak 降级信号）', () => {
    const prepared = prepareAvatarModel(makeScene([]) as never, [
      makeClip('Idle'),
      makeClip('Yes'),
      makeClip('Wave'),
      makeClip('Death'), // 不在候选表内，忽略
    ]);

    const idle = prepared.clipMap.idle as THREE.AnimationClip;
    const nod = prepared.clipMap.nod as THREE.AnimationClip;
    expect((idle as unknown as { name: string }).name).toBe('Idle');
    expect((nod as unknown as { name: string }).name).toBe('Yes');
    expect(prepared.clipMap.wave).toBeDefined();
    expect(prepared.clipMap.shakeHead).toBeUndefined();
    expect(prepared.clipMap.dance).toBeUndefined();
    expect(prepared.clipMap.think).toBeUndefined();
  });
});
