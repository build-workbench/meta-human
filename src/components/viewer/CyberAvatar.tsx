/**
 * 程序化数字人头像组件。
 *
 * 使用 Three.js 基础几何体构建的软萌可爱风格头像，
 * 支持表情、动画和语音同步。
 */

import { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { shallow } from 'zustand/shallow';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useIsTabVisibleRef } from '@/hooks';

interface CyberAvatarProps {
  prefersReducedMotion: boolean;
}

export function CyberAvatar({ prefersReducedMotion }: CyberAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Mesh>(null);
  const rightEyeRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  // 使用 ref 避免 useFrame 中触发重渲染
  const storeRef = useRef(useDigitalHumanStore.getState());
  const intensityRef = useRef(storeRef.current.expressionIntensity ?? 0.8);
  const isVisibleRef = useIsTabVisibleRef();

  // 精细订阅：仅在 useFrame 实际读取的字段变化时更新 ref。
  // 嘴型开合度走 mouthOpenSignal（useFrame 直读），不经过 store 订阅。
  useEffect(() => {
    const unsubscribe = useDigitalHumanStore.subscribe(
      (s) => ({
        currentExpression: s.currentExpression,
        isSpeaking: s.isSpeaking,
        currentAnimation: s.currentAnimation,
        expressionIntensity: s.expressionIntensity,
      }),
      (slice) => {
        storeRef.current = useDigitalHumanStore.getState();
        intensityRef.current = slice.expressionIntensity ?? 0.8;
      },
      { equalityFn: shallow },
    );
    return unsubscribe;
  }, []);

  useFrame((state) => {
    // 标签页不可见时跳过动画
    if (!isVisibleRef.current) return;

    const t = state.clock.elapsedTime;
    // 从 ref 读取状态，避免重渲染
    const { currentExpression, isSpeaking, currentAnimation } = storeRef.current;
    const intensity = Math.max(0, Math.min(1, intensityRef.current));

    // 减少动画模式且非必要动画时跳过
    if (prefersReducedMotion && currentAnimation === 'idle' && !isSpeaking) {
      return;
    }

    // 漂浮逻辑由 <Float> 组件处理
    if (group.current) {
      // 基于动画状态的头部运动
      const anim = currentAnimation;
      if (anim === 'nod') {
        group.current.rotation.x = Math.sin(t * 5) * 0.2;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else if (anim === 'shakeHead') {
        group.current.rotation.y = Math.sin(t * 5) * 0.3;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else if (anim === 'think') {
        group.current.rotation.z = Math.sin(t * 1.5) * 0.15;
        group.current.rotation.x = Math.sin(t * 0.8) * 0.1;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      } else if (anim === 'speak') {
        group.current.rotation.x = Math.sin(t * 3) * 0.03;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else {
        // idle — 平滑返回中立旋转
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      }
    }

    // 说话动画（下巴/头部摆动）；停止后平滑归零，避免冻结在最后一个采样点
    if (headRef.current) {
      const targetHeadX = !prefersReducedMotion && isSpeaking ? Math.sin(t * 15) * 0.05 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        targetHeadX,
        0.3,
      );
    }

    // 表情
    if (leftEyeRef.current?.scale && rightEyeRef.current?.scale) {
      const baseScaleY = 1;
      let targetScaleY = baseScaleY;

      // 眨眼逻辑
      const blink = Math.sin(t * 3);
      const isBlinking = blink > 0.98 || currentExpression === 'blink';

      // 情绪逻辑
      if (currentExpression === 'smile') {
        targetScaleY = 0.5;
      } else if (currentExpression === 'surprise') {
        targetScaleY = 1.3;
      }

      const scaleY = isBlinking ? 0.1 : THREE.MathUtils.lerp(baseScaleY, targetScaleY, intensity);

      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, scaleY, 0.2);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, scaleY, 0.2);
    }

    // 嘴型 Lipsync：由 TTS 驱动 mouthOpenSignal（0-1），渲染层每帧直读并平滑跟随
    if (mouthRef.current?.scale) {
      const mouthOpen = mouthOpenSignal.value;
      const targetMouthY = 0.15 + mouthOpen * 0.85;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetMouthY, 0.3);
      // 嘴部张开时略变窄
      const targetMouthX = 1 - mouthOpen * 0.2;
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targetMouthX, 0.3);
    }

    // 光环动画
    if (!prefersReducedMotion && ringsRef.current?.rotation) {
      const anim = currentAnimation;
      let ringSpeed = 0.2;
      let ringTilt = 0;
      let ringWobble = 0;

      if (anim === 'waveHand' || anim === 'wave' || anim === 'greet') {
        ringSpeed = 2.0;
        ringWobble = 0.5;
      } else if (anim === 'raiseHand') {
        ringTilt = Math.PI / 6;
        ringSpeed = 0.5;
      } else if (anim === 'excited' || anim === 'dance') {
        ringSpeed = 3.0;
        ringWobble = 0.3;
      } else if (anim === 'think') {
        ringSpeed = 0.5;
        ringTilt = Math.PI / 12;
      }

      ringsRef.current.rotation.y += ringSpeed * 0.05;
      ringsRef.current.rotation.z =
        Math.sin(t * 0.5 + ringSpeed) * 0.1 + Math.sin(t * 10) * ringWobble;
      ringsRef.current.rotation.x = THREE.MathUtils.lerp(
        ringsRef.current.rotation.x,
        ringTilt,
        0.1,
      );
    }
  });

  return (
    <group ref={group}>
      {/* 漂浮容器 */}
      <Float
        speed={prefersReducedMotion ? 0 : 2}
        rotationIntensity={0.2}
        floatIntensity={prefersReducedMotion ? 0 : 0.5}
      >
        {/* --- 天线 --- */}
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.35, 16]} />
          <meshStandardMaterial color="#ffb3c1" metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[0, 1.12, 0]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshStandardMaterial
            color="#ff8fab"
            emissive="#ff8fab"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>

        {/* --- 头部：圆润的大头，往可爱方向的比例 --- */}
        <mesh ref={headRef} position={[0, 0, 0]} castShadow receiveShadow scale={[1, 0.95, 1]}>
          <sphereGeometry args={[0.8, 64, 64]} />
          <meshStandardMaterial color="#fff3ea" metalness={0.05} roughness={0.55} />
        </mesh>

        {/* --- 眼睛：大圆眼 + 高光 --- */}
        <group position={[0, 0.12, 0.72]}>
          <mesh ref={leftEyeRef} position={[-0.28, 0, 0]}>
            <sphereGeometry args={[0.11, 24, 24]} />
            <meshStandardMaterial color="#26262e" roughness={0.25} />
            <mesh position={[0.035, 0.045, 0.075]} scale={[0.42, 0.42, 0.42]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={0.8}
                toneMapped={false}
              />
            </mesh>
          </mesh>
          <mesh ref={rightEyeRef} position={[0.28, 0, 0]}>
            <sphereGeometry args={[0.11, 24, 24]} />
            <meshStandardMaterial color="#26262e" roughness={0.25} />
            <mesh position={[0.035, 0.045, 0.075]} scale={[0.42, 0.42, 0.42]}>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#ffffff"
                emissiveIntensity={0.8}
                toneMapped={false}
              />
            </mesh>
          </mesh>
        </group>

        {/* --- 腮红：软粉脸颊 --- */}
        <mesh position={[-0.52, -0.18, 0.64]} scale={[0.5, 0.25, 0.2]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color="#ffb3c1"
            transparent
            opacity={0.85}
            emissive="#ffb3c1"
            emissiveIntensity={0.3}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0.52, -0.18, 0.64]} scale={[0.5, 0.25, 0.2]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial
            color="#ffb3c1"
            transparent
            opacity={0.85}
            emissive="#ffb3c1"
            emissiveIntensity={0.3}
            toneMapped={false}
          />
        </mesh>

        {/* --- 嘴部（Lipsync 驱动，椭圆小嘴） --- */}
        <mesh ref={mouthRef} position={[0, -0.3, 0.78]} scale={[0.85, 0.2, 0.15]}>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshStandardMaterial
            color="#ff6b9d"
            emissive="#ff6b9d"
            emissiveIntensity={0.6}
            toneMapped={false}
          />
        </mesh>

        {/* --- 软萌小身体 --- */}
        <mesh position={[0, -0.8, 0]} scale={[1, 1.15, 1]} castShadow>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="#fde8e0" metalness={0.05} roughness={0.55} />
        </mesh>

        {/* --- 全息光环 --- */}
        <group ref={ringsRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.2, 0.02, 16, 100]} />
            <meshBasicMaterial
              color="#ffb3c1"
              transparent
              opacity={0.35}
              side={THREE.DoubleSide}
              wireframe
            />
          </mesh>
          <mesh rotation={[Math.PI / 2.2, 0, 0]}>
            <torusGeometry args={[1.4, 0.01, 16, 100]} />
            <meshBasicMaterial
              color="#ffd6e0"
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
              wireframe
            />
          </mesh>
        </group>
      </Float>
    </group>
  );
}
