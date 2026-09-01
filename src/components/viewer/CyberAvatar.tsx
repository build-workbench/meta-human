/**
 * 程序化数字人头像组件 — 极简可爱版 v2。
 *
 * 设计契约（防丑）：
 * - 全哑光（roughness 0.9+，无 emissive/金属）
 * - 3色组：奶白脸 #f6efe7 / 炭灰发 #383a40 / 雾蓝身 #eef2fb
 * - 部件极简、无天线/光环/wireframe
 * - 扁椭球眼 + 深色扁豆嘴，侧面不贴纸
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
  const browRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);

  // 使用 ref 避免 useFrame 中触发重渲染
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
        group.current.rotation.x = Math.sin(t * 5) * 0.15;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else if (anim === 'shakeHead') {
        group.current.rotation.y = Math.sin(t * 5) * 0.22;
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else if (anim === 'think') {
        group.current.rotation.z = Math.sin(t * 1.5) * 0.12;
        group.current.rotation.x = Math.sin(t * 0.8) * 0.08;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      } else if (anim === 'speak') {
        group.current.rotation.x = Math.sin(t * 3) * 0.025;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else {
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      }
    }

    if (headRef.current) {
      const targetHeadX = !prefersReducedMotion && isSpeaking ? Math.sin(t * 15) * 0.04 : 0;
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
      const scaleY = isBlinking ? 0.12 : THREE.MathUtils.lerp(baseScaleY, targetScaleY, intensity);
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, scaleY, 0.2);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, scaleY, 0.2);
    }

    if (browRef.current) {
      let browY = 0;
      let browRot = 0;
      if (currentExpression === 'surprise') {
        browY = 0.06;
      } else if (currentExpression === 'sad') {
        browRot = 0.18;
        browY = -0.02;
      } else if (currentExpression === 'angry') {
        browRot = -0.22;
        browY = -0.03;
      } else if (currentExpression === 'smile') {
        browY = 0.02;
      }
      browRef.current.position.y = THREE.MathUtils.lerp(browRef.current.position.y, browY, 0.15);
      browRef.current.rotation.z = THREE.MathUtils.lerp(browRef.current.rotation.z, browRot, 0.15);
    }

    if (mouthRef.current?.scale) {
      const mouthOpen = mouthOpenSignal.value;
      const targetMouthY = 0.7 + mouthOpen * 0.4;
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targetMouthY, 0.32);
      const targetMouthX = 1 - mouthOpen * 0.08;
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targetMouthX, 0.32);
    }
  });

  return (
    <group ref={group}>
      <Float
        speed={prefersReducedMotion ? 0 : 0.9}
        rotationIntensity={0.04}
        floatIntensity={prefersReducedMotion ? 0 : 0.22}
      >
        {/* 头部 */}
        <mesh
          ref={headRef}
          position={[0, 0, 0]}
          castShadow
          receiveShadow
          scale={[1.06, 0.97, 0.96]}
        >
          <sphereGeometry args={[0.62, 64, 64]} />
          <meshStandardMaterial color="#f6efe7" roughness={0.92} metalness={0} />
        </mesh>

        {/* 头发 — 顶部球冠，炭灰（碗盖，留出额头呼吸感） */}
        <mesh position={[0, 0.26, -0.06]}>
          <sphereGeometry args={[0.68, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
          <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
        </mesh>

        {/* 刘海 — 打破头盔硬切线 */}
        <mesh position={[-0.14, 0.36, 0.42]} rotation={[0.22, 0, 0.18]}>
          <capsuleGeometry args={[0.042, 0.11, 8, 16]} />
          <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0.14, 0.36, 0.42]} rotation={[0.22, 0, -0.18]}>
          <capsuleGeometry args={[0.042, 0.11, 8, 16]} />
          <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
        </mesh>
        <mesh position={[0, 0.38, 0.46]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.038, 0.09, 8, 16]} />
          <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
        </mesh>

        {/* 呆毛 — 放大且更俏皮，明确是设计 */}
        <mesh position={[0.12, 0.86, 0.06]} rotation={[0, 0, -0.58]}>
          <capsuleGeometry args={[0.022, 0.3, 8, 16]} />
          <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
        </mesh>

        {/* 眉毛 */}
        <group ref={browRef} position={[0, 0.28, 0.58]}>
          <mesh position={[-0.22, 0, 0]} rotation={[0, 0, 0.08]}>
            <capsuleGeometry args={[0.016, 0.14, 4, 12]} />
            <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
          </mesh>
          <mesh position={[0.22, 0, 0]} rotation={[0, 0, -0.08]}>
            <capsuleGeometry args={[0.016, 0.14, 4, 12]} />
            <meshStandardMaterial color="#383a40" roughness={0.95} metalness={0} />
          </mesh>
        </group>

        {/* 眼睛 — 扁椭球眼白 + 虹膜 + 瞳孔 + 高光 */}
        <group position={[0, 0.08, 0.56]}>
          {/* 左眼 */}
          <mesh ref={leftEyeRef} position={[-0.22, 0, 0]} scale={[1, 1.18, 0.35]}>
            <sphereGeometry args={[0.13, 32, 24]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0} />
            <mesh position={[0, -0.02, 0.085]}>
              <sphereGeometry args={[0.075, 24, 24]} />
              <meshStandardMaterial color="#6ea8e6" roughness={0.9} metalness={0} />
              <mesh position={[0, 0, 0.045]}>
                <sphereGeometry args={[0.038, 20, 20]} />
                <meshStandardMaterial color="#14161c" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[0.028, 0.028, 0.058]}>
                <sphereGeometry args={[0.022, 14, 14]} />
                <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
              </mesh>
              <mesh position={[-0.018, -0.018, 0.05]}>
                <sphereGeometry args={[0.01, 12, 12]} />
                <meshStandardMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.85}
                  roughness={1}
                  metalness={0}
                />
              </mesh>
            </mesh>
          </mesh>

          {/* 右眼 */}
          <mesh ref={rightEyeRef} position={[0.22, 0, 0]} scale={[1, 1.18, 0.35]}>
            <sphereGeometry args={[0.13, 32, 24]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} metalness={0} />
            <mesh position={[0, -0.02, 0.085]}>
              <sphereGeometry args={[0.075, 24, 24]} />
              <meshStandardMaterial color="#6ea8e6" roughness={0.9} metalness={0} />
              <mesh position={[0, 0, 0.045]}>
                <sphereGeometry args={[0.038, 20, 20]} />
                <meshStandardMaterial color="#14161c" roughness={0.9} metalness={0} />
              </mesh>
              <mesh position={[0.028, 0.028, 0.058]}>
                <sphereGeometry args={[0.022, 14, 14]} />
                <meshStandardMaterial color="#ffffff" roughness={1} metalness={0} />
              </mesh>
              <mesh position={[-0.018, -0.018, 0.05]}>
                <sphereGeometry args={[0.01, 12, 12]} />
                <meshStandardMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.85}
                  roughness={1}
                  metalness={0}
                />
              </mesh>
            </mesh>
          </mesh>
        </group>

        {/* 腮红 — 淡粉扁球，无 emissive */}
        <mesh position={[-0.36, -0.14, 0.52]} scale={[1, 0.55, 0.22]}>
          <sphereGeometry args={[0.09, 20, 16]} />
          <meshStandardMaterial
            color="#e8a3a8"
            transparent
            opacity={0.32}
            roughness={1}
            metalness={0}
          />
        </mesh>
        <mesh position={[0.36, -0.14, 0.52]} scale={[1, 0.55, 0.22]}>
          <sphereGeometry args={[0.09, 20, 16]} />
          <meshStandardMaterial
            color="#e8a3a8"
            transparent
            opacity={0.32}
            roughness={1}
            metalness={0}
          />
        </mesh>

        {/* 嘴 — 微笑弧（torus 半环），张口时随 mouthOpen 纵向张开 */}
        <group
          ref={mouthRef as unknown as React.RefObject<THREE.Group>}
          position={[0, -0.24, 0.58]}
        >
          <mesh rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.068, 0.016, 10, 24, Math.PI]} />
            <meshStandardMaterial color="#3b2f33" roughness={0.9} metalness={0} />
          </mesh>
        </group>

        {/* 颈 */}
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.13, 0.15, 0.18, 24]} />
          <meshStandardMaterial color="#f6efe7" roughness={0.92} metalness={0} />
        </mesh>

        {/* 身体 — 胶囊 */}
        <mesh position={[0, -0.98, 0]} castShadow>
          <capsuleGeometry args={[0.34, 0.58, 8, 24]} />
          <meshStandardMaterial color="#eef2fb" roughness={0.92} metalness={0} />
        </mesh>

        {/* 小短手 */}
        <mesh position={[-0.42, -0.92, 0]} rotation={[0, 0, 0.38]}>
          <capsuleGeometry args={[0.09, 0.26, 8, 16]} />
          <meshStandardMaterial color="#eef2fb" roughness={0.92} metalness={0} />
        </mesh>
        <mesh position={[0.42, -0.92, 0]} rotation={[0, 0, -0.38]}>
          <capsuleGeometry args={[0.09, 0.26, 8, 16]} />
          <meshStandardMaterial color="#eef2fb" roughness={0.92} metalness={0} />
        </mesh>

        {/* 落地基座 — 极淡柔光圆，解决悬浮感 */}
        <mesh position={[0, -1.38, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.85, 48]} />
          <meshStandardMaterial
            color="#8ea8d8"
            transparent
            opacity={0.08}
            roughness={1}
            metalness={0}
          />
        </mesh>
      </Float>
    </group>
  );
}
