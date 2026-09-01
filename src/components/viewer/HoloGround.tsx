/**
 * 地面全息投影环 — 数字人脚下的科技感接地元素。
 *
 * 三层结构（自下而上同一水平面，additive 叠加）：
 * - 静态底盘亮环 + 内部淡光盘（恒定）
 * - 声呐脉冲环：说话时向外扩散（频率固定、强度跟随口型信号）；
 *   静止时仅保留缓慢呼吸微脉；reduced motion 完全静止
 *
 * 仅在 GLB 模型模式下渲染（Scene 控制）；程序化 CyberAvatar 自带基座光盘。
 */
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { shallow } from 'zustand/shallow';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useIsTabVisibleRef } from '@/hooks';

interface HoloGroundProps {
  prefersReducedMotion: boolean;
}

/** 地面高度：模型脚底（-1.3）略下方，与 ContactShadows 平面对齐。 */
export const GROUND_Y = -1.34;
const RING_INNER = 0.55;
const RING_OUTER = 0.6;
const PING_START = 0.62;
const PING_END = 1.05;
const PING_DURATION = 1.2;
const CYAN = '#22d3ee';

export function HoloGround({ prefersReducedMotion }: HoloGroundProps) {
  const pingRef = useRef<THREE.Mesh>(null);
  const storeRef = useRef(useDigitalHumanStore.getState());
  const phaseRef = useRef(0);
  const isVisibleRef = useIsTabVisibleRef();

  useEffect(() => {
    const unsubscribe = useDigitalHumanStore.subscribe(
      (s) => ({ isSpeaking: s.isSpeaking }),
      () => {
        storeRef.current = useDigitalHumanStore.getState();
      },
      { equalityFn: shallow },
    );
    return unsubscribe;
  }, []);

  useFrame((state, delta) => {
    if (!isVisibleRef.current) return;
    const mesh = pingRef.current;
    if (!mesh) return;
    const material = mesh.material as THREE.MeshBasicMaterial;

    const speaking = storeRef.current.isSpeaking && !prefersReducedMotion;
    if (speaking) {
      // 声呐脉冲：固定节奏向外扩散，强度跟随口型
      phaseRef.current = (phaseRef.current + delta / PING_DURATION) % 1;
      const radius = THREE.MathUtils.lerp(PING_START, PING_END, phaseRef.current);
      mesh.scale.setScalar(radius);
      material.opacity = (1 - phaseRef.current) * (0.18 + 0.4 * mouthOpenSignal.value);
    } else if (prefersReducedMotion) {
      mesh.scale.setScalar(PING_START);
      material.opacity = 0;
    } else {
      // 静止呼吸微脉
      const breathe = Math.sin(state.clock.elapsedTime * 1.2);
      mesh.scale.setScalar(PING_START + breathe * 0.02);
      material.opacity = 0.08 + breathe * 0.03;
    }
  });

  return (
    <group position={[0, GROUND_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* 静态底盘亮环 */}
      <mesh>
        <ringGeometry args={[RING_INNER, RING_OUTER, 64]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 内部淡光盘 */}
      <mesh>
        <circleGeometry args={[RING_INNER, 48]} />
        <meshBasicMaterial
          color="#0e7490"
          transparent
          opacity={0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 声呐脉冲环（细环，靠 scale 扩散） */}
      <mesh ref={pingRef}>
        <ringGeometry args={[0.97, 1, 64]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
