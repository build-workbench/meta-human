/**
 * 程序化数字人头像组件 — 优化版 (v2)
 *
 * 目标：解决截图中“雪人感、灰塑料感、眼无神、天线突兀、光环遮面”五大丑点，
 * 保持零依赖程序化（不引入外部 GLB），同时让“可爱”落到材质与比例而非堆色。
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

  const storeRef = useRef(useDigitalHumanStore.getState());
  const intensityRef = useRef(storeRef.current.expressionIntensity ?? 0.8);
  const isVisibleRef = useIsTabVisibleRef();

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
    if (!isVisibleRef.current) return;

    const t = state.clock.elapsedTime;
    const { currentExpression, isSpeaking, currentAnimation } = storeRef.current;
    const intensity = Math.max(0, Math.min(1, intensityRef.current));

    if (prefersReducedMotion && currentAnimation === 'idle' && !isSpeaking) {
      return;
    }

    if (group.current) {
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
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      }
    }

    if (headRef.current) {
      const targetHeadX = !prefersReducedMotion && isSpeaking ? Math.sin(t * 15) * 0.05 : 0;
      headRef.current.rotation.x = THREE.MathUtils.lerp(
        headRef.current.rotation.x,
        targetHeadX,
        0.3,
      );
    }

    if (leftEyeRef.current?.scale && rightEyeRef.current?.scale) {
      const baseScaleY = 1;
      let targetScaleY = baseScaleY;
      const blink = Math.sin(t * 3);
      const isBlinking = blink > 0.98 || currentExpression === 'blink';
      if (currentExpression === 'smile') {
        targetScaleY = 0.55;
      } else if (currentExpression === 'surprise') {
        targetScaleY = 1.25;
      }
      const scaleY = isBlinking ? 0.08 : THREE.MathUtils.lerp(baseScaleY, targetScaleY, intensity);
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, scaleY, 0.22);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, scaleY, 0.22);
    }

    if (mouthRef.current?.scale) {
      const mouthOpen = mouthOpenSignal.value;
      const targetMouthY = 0.18 + mouthOpen * 0.9;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetMouthY, 0.32);
      const targetMouthX = 1 - mouthOpen * 0.18;
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targetMouthX, 0.32);
    }

    if (!prefersReducedMotion && ringsRef.current?.rotation) {
      const anim = currentAnimation;
      let ringSpeed = 0.22;
      let ringTilt = 0.08;
      let ringWobble = 0;

      if (anim === 'waveHand' || anim === 'wave' || anim === 'greet') {
        ringSpeed = 1.9;
        ringWobble = 0.42;
      } else if (anim === 'raiseHand') {
        ringTilt = Math.PI / 6;
        ringSpeed = 0.5;
      } else if (anim === 'excited' || anim === 'dance') {
        ringSpeed = 2.8;
        ringWobble = 0.28;
      } else if (anim === 'think') {
        ringSpeed = 0.45;
        ringTilt = Math.PI / 14;
      }

      ringsRef.current.rotation.y += ringSpeed * 0.045;
      ringsRef.current.rotation.z =
        Math.sin(t * 0.5 + ringSpeed) * 0.08 + Math.sin(t * 10) * ringWobble;
      ringsRef.current.rotation.x = THREE.MathUtils.lerp(
        ringsRef.current.rotation.x,
        ringTilt,
        0.1,
      );
    }
  });

  return (
    <group ref={group}>
      <Float
        speed={prefersReducedMotion ? 0 : 1.6}
        rotationIntensity={0.12}
        floatIntensity={prefersReducedMotion ? 0 : 0.32}
      >
        {/* --- 头发：覆盖头顶的蓬松发量，替代突兀天线 --- */}
        <mesh position={[0, 0.34, -0.06]} scale={[1.06, 0.62, 1.06]} castShadow>
          <sphereGeometry args={[0.82, 48, 48]} />
          <meshStandardMaterial color="#6B3A2A" roughness={0.85} metalness={0.0} />
        </mesh>
        {/* 前额刘海 */}
        <mesh position={[0, 0.42, 0.28]} scale={[1.02, 0.45, 0.85]} castShadow>
          <sphereGeometry args={[0.62, 32, 32]} />
          <meshStandardMaterial color="#7A4530" roughness={0.82} />
        </mesh>
        {/* 左右丸子发髻 */}
        <mesh position={[-0.62, 0.38, -0.08]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#6B3A2A" roughness={0.85} />
        </mesh>
        <mesh position={[0.62, 0.38, -0.08]} castShadow>
          <sphereGeometry args={[0.22, 24, 24]} />
          <meshStandardMaterial color="#6B3A2A" roughness={0.85} />
        </mesh>
        {/* 发髻粉色蝴蝶结点缀 */}
        <mesh position={[-0.62, 0.44, 0.08]} scale={[1, 0.65, 0.35]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color="#FF8FAB"
            roughness={0.6}
            emissive="#FF8FAB"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[0.62, 0.44, 0.08]} scale={[1, 0.65, 0.35]}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshStandardMaterial
            color="#FF8FAB"
            roughness={0.6}
            emissive="#FF8FAB"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[-0.62, 0.44, 0.08]} scale={[0.55, 0.55, 0.55]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#FF4D7A" roughness={0.5} />
        </mesh>
        <mesh position={[0.62, 0.44, 0.08]} scale={[0.55, 0.55, 0.55]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color="#FF4D7A" roughness={0.5} />
        </mesh>

        {/* --- 头部：暖米肤色 + 物理材质，告别灰塑料 --- */}
        <mesh ref={headRef} position={[0, -0.02, 0]} castShadow receiveShadow scale={[1, 1.02, 1]}>
          <sphereGeometry args={[0.78, 64, 64]} />
          <meshPhysicalMaterial
            color="#FFEAD8"
            roughness={0.42}
            metalness={0.0}
            clearcoat={0.35}
            clearcoatRoughness={0.35}
            sheen={0.6}
            sheenRoughness={0.55}
            sheenColor="#FFD6C2"
          />
        </mesh>

        {/* --- 耳朵：补全“人”形剪影 --- */}
        <mesh position={[-0.74, -0.05, 0.02]} scale={[0.38, 0.62, 0.32]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshPhysicalMaterial color="#FFDDC8" roughness={0.5} />
        </mesh>
        <mesh position={[0.74, -0.05, 0.02]} scale={[0.38, 0.62, 0.32]} castShadow>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshPhysicalMaterial color="#FFDDC8" roughness={0.5} />
        </mesh>
        <mesh position={[-0.74, -0.05, 0.08]} scale={[0.22, 0.34, 0.18]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#FFB3A0" roughness={0.6} />
        </mesh>
        <mesh position={[0.74, -0.05, 0.08]} scale={[0.22, 0.34, 0.18]}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshStandardMaterial color="#FFB3A0" roughness={0.6} />
        </mesh>

        {/* --- 眼睛：白眼白 + 棕虹膜 + 双层高光，有“眼神” --- */}
        <group position={[0, 0.1, 0.68]}>
          {/* 左眼 */}
          <mesh ref={leftEyeRef} position={[-0.27, 0, 0]} scale={[1, 1, 0.72]}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshStandardMaterial color="#FFF8F0" roughness={0.22} />
            {/* 虹膜 */}
            <mesh position={[0, -0.01, 0.11]}>
              <sphereGeometry args={[0.078, 24, 24]} />
              <meshStandardMaterial color="#4A2E1E" roughness={0.35} />
              {/* 瞳孔 */}
              <mesh position={[0, 0, 0.035]}>
                <sphereGeometry args={[0.042, 16, 16]} />
                <meshStandardMaterial color="#1A120E" roughness={0.2} />
              </mesh>
              {/* 主高光 */}
              <mesh position={[0.028, 0.032, 0.055]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  emissive="#FFFFFF"
                  emissiveIntensity={0.9}
                  toneMapped={false}
                />
              </mesh>
              {/* 次高光 */}
              <mesh position={[-0.018, -0.018, 0.05]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.011, 10, 10]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  transparent
                  opacity={0.85}
                  toneMapped={false}
                />
              </mesh>
            </mesh>
            {/* 眼睑阴影（上） */}
            <mesh position={[0, 0.09, 0.04]} scale={[1.18, 0.22, 0.82]} rotation={[0.15, 0, 0]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color="#E8C4B0" transparent opacity={0.22} roughness={1} />
            </mesh>
          </mesh>

          {/* 右眼 */}
          <mesh ref={rightEyeRef} position={[0.27, 0, 0]} scale={[1, 1, 0.72]}>
            <sphereGeometry args={[0.15, 32, 32]} />
            <meshStandardMaterial color="#FFF8F0" roughness={0.22} />
            <mesh position={[0, -0.01, 0.11]}>
              <sphereGeometry args={[0.078, 24, 24]} />
              <meshStandardMaterial color="#4A2E1E" roughness={0.35} />
              <mesh position={[0, 0, 0.035]}>
                <sphereGeometry args={[0.042, 16, 16]} />
                <meshStandardMaterial color="#1A120E" roughness={0.2} />
              </mesh>
              <mesh position={[0.028, 0.032, 0.055]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.022, 12, 12]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  emissive="#FFFFFF"
                  emissiveIntensity={0.9}
                  toneMapped={false}
                />
              </mesh>
              <mesh position={[-0.018, -0.018, 0.05]} scale={[1, 1, 0.6]}>
                <sphereGeometry args={[0.011, 10, 10]} />
                <meshStandardMaterial
                  color="#FFFFFF"
                  transparent
                  opacity={0.85}
                  toneMapped={false}
                />
              </mesh>
            </mesh>
            <mesh position={[0, 0.09, 0.04]} scale={[1.18, 0.22, 0.82]} rotation={[0.15, 0, 0]}>
              <sphereGeometry args={[0.12, 16, 16]} />
              <meshStandardMaterial color="#E8C4B0" transparent opacity={0.22} roughness={1} />
            </mesh>
          </mesh>
        </group>

        {/* --- 眉毛：细微弧度带表情 --- */}
        <mesh position={[-0.27, 0.3, 0.64]} rotation={[0, 0, 0.08]} scale={[1, 1, 0.5]}>
          <capsuleGeometry args={[0.022, 0.18, 8, 16]} />
          <meshStandardMaterial color="#5A3626" roughness={0.85} />
        </mesh>
        <mesh position={[0.27, 0.3, 0.64]} rotation={[0, 0, -0.08]} scale={[1, 1, 0.5]}>
          <capsuleGeometry args={[0.022, 0.18, 8, 16]} />
          <meshStandardMaterial color="#5A3626" roughness={0.85} />
        </mesh>

        {/* --- 鼻子：微凸鼻尖，立体感 --- */}
        <mesh position={[0, -0.06, 0.745]} scale={[0.55, 0.42, 0.42]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial color="#FFCDB8" roughness={0.55} />
        </mesh>
        <mesh position={[0, -0.065, 0.76]} scale={[0.28, 0.18, 0.18]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#FFB8A0" roughness={0.6} />
        </mesh>

        {/* --- 腮红：更柔和的大面积晕染 --- */}
        <mesh position={[-0.46, -0.16, 0.6]} scale={[0.62, 0.32, 0.28]}>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshStandardMaterial color="#FF9EB1" transparent opacity={0.38} roughness={1} />
        </mesh>
        <mesh position={[0.46, -0.16, 0.6]} scale={[0.62, 0.32, 0.28]}>
          <sphereGeometry args={[0.14, 20, 20]} />
          <meshStandardMaterial color="#FF9EB1" transparent opacity={0.38} roughness={1} />
        </mesh>

        {/* --- 嘴部：上下唇分明，支持 lipsync --- */}
        <group position={[0, -0.3, 0.745]}>
          {/* 上唇阴影 */}
          <mesh position={[0, 0.02, 0]} scale={[1, 0.55, 0.5]}>
            <capsuleGeometry args={[0.018, 0.14, 8, 12]} />
            <meshStandardMaterial color="#E86B8A" roughness={0.6} />
          </mesh>
          {/* 下唇主体（缩放驱动张合） */}
          <mesh ref={mouthRef} scale={[1, 0.22, 1]} rotation={[0, 0, 0]}>
            <capsuleGeometry args={[0.038, 0.12, 10, 16]} />
            <meshPhysicalMaterial
              color="#E84A6B"
              roughness={0.35}
              clearcoat={0.25}
              emissive="#FF6B8A"
              emissiveIntensity={0.12}
            />
          </mesh>
          {/* 口腔内侧（张嘴时可见） */}
          <mesh position={[0, -0.01, -0.02]} scale={[0.62, 0.42, 0.35]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#3A1018" roughness={1} />
          </mesh>
        </group>

        {/* --- 身体：奶咖卫衣 + 简易双臂，告别“雪人水滴” --- */}
        <mesh position={[0, -0.82, 0]} scale={[1.02, 1.08, 0.92]} castShadow>
          <sphereGeometry args={[0.52, 32, 32]} />
          <meshPhysicalMaterial color="#FFF0E6" roughness={0.62} clearcoat={0.15} />
        </mesh>
        {/* 卫衣领口 */}
        <mesh position={[0, -0.52, 0.28]} rotation={[0.22, 0, 0]} scale={[1, 0.45, 0.6]}>
          <torusGeometry args={[0.28, 0.045, 16, 32]} />
          <meshStandardMaterial color="#FFD6C2" roughness={0.7} />
        </mesh>
        {/* 卫衣口袋 */}
        <mesh position={[0, -0.82, 0.42]} scale={[0.58, 0.38, 0.22]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color="#FFE8D8" roughness={0.65} />
        </mesh>

        {/* 手臂 */}
        <mesh position={[-0.52, -0.78, 0.04]} rotation={[0, 0, 0.42]} castShadow>
          <capsuleGeometry args={[0.11, 0.38, 10, 16]} />
          <meshStandardMaterial color="#FFF0E6" roughness={0.62} />
        </mesh>
        <mesh position={[0.52, -0.78, 0.04]} rotation={[0, 0, -0.42]} castShadow>
          <capsuleGeometry args={[0.11, 0.38, 10, 16]} />
          <meshStandardMaterial color="#FFF0E6" roughness={0.62} />
        </mesh>
        {/* 小手 */}
        <mesh position={[-0.68, -1.02, 0.06]} scale={[1, 0.85, 0.85]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#FFDCC6" roughness={0.52} />
        </mesh>
        <mesh position={[0.68, -1.02, 0.06]} scale={[1, 0.85, 0.85]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#FFDCC6" roughness={0.52} />
        </mesh>

        {/* --- 全息光环：上移避开眼位，细腻不抢戏 --- */}
        <group ref={ringsRef} position={[0, 0.06, 0]}>
          <mesh rotation={[Math.PI / 2.35, 0, 0]}>
            <torusGeometry args={[1.18, 0.014, 16, 96]} />
            <meshBasicMaterial color="#FFB3C8" transparent opacity={0.38} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2.15, 0, 0]}>
            <torusGeometry args={[1.36, 0.009, 16, 96]} />
            <meshBasicMaterial color="#FFE4EC" transparent opacity={0.28} side={THREE.DoubleSide} />
          </mesh>
          {/* 内侧微光环 */}
          <mesh rotation={[Math.PI / 2.5, 0, 0]}>
            <torusGeometry args={[0.98, 0.007, 16, 64]} />
            <meshBasicMaterial color="#FFD6E2" transparent opacity={0.22} side={THREE.DoubleSide} />
          </mesh>
        </group>
      </Float>
    </group>
  );
}
