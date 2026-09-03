/**
 * 3D 场景配置组件。
 *
 * 配置光照、相机、粒子和轨道控制。
 */

import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Lightformer,
  Sparkles,
  ContactShadows,
} from '@react-three/drei';
import { usePrefersReducedMotion } from '@/hooks';
import { CyberAvatar } from './CyberAvatar';
import { ModelAvatar } from './ModelAvatar';
import { HoloGround, GROUND_Y } from './HoloGround';
import { KeyboardControls } from './KeyboardControls';
import type { PreparedAvatarModel } from '@/core/avatar/avatarModelPrepare';

interface SceneProps {
  autoRotate?: boolean;
  model?: PreparedAvatarModel | null;
}

export function Scene({ autoRotate, model }: SceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0.12, 5.4]} fov={45} />

      {/* 光照：暖调三点布光，肤色不再泛青 */}
      <ambientLight intensity={0.72} color="#FFF6ED" />
      <directionalLight
        position={[4, 6, 5]}
        intensity={1.15}
        color="#FFF0E0"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <spotLight
        position={[2, 5, 4]}
        angle={0.32}
        penumbra={0.85}
        intensity={1.4}
        color="#FFE8D8"
        castShadow={false}
      />
      <pointLight position={[-3.5, 2, -2]} intensity={0.55} color="#FFD6E0" />
      <pointLight position={[0, -1, 3]} intensity={0.45} color="#FFB3C8" distance={6} decay={2} />

      {/* 环境反射：暖粉光带，离线可用（不依赖外部 HDR） */}
      <Environment resolution={256}>
        <Lightformer
          intensity={1.15}
          color="#FFF7ED"
          rotation-x={Math.PI / 2}
          position={[0, 5, 0]}
          scale={[10, 10, 1]}
        />
        <Lightformer
          intensity={0.85}
          color="#FFB3C8"
          rotation-y={Math.PI}
          position={[0, 1, 5]}
          scale={[8, 3.2, 1]}
        />
        <Lightformer
          intensity={0.45}
          color="#FFD6B8"
          rotation-y={-Math.PI / 2}
          position={[-5, 1, -1]}
          scale={[6, 2, 1]}
        />
        <Lightformer
          intensity={0.38}
          color="#FFD6E2"
          rotation-y={Math.PI / 2}
          position={[5, 0, -1]}
          scale={[6, 2, 1]}
        />
      </Environment>

      {/* 数字人 */}
      {model ? (
        <ModelAvatar model={model} prefersReducedMotion={prefersReducedMotion} />
      ) : (
        <CyberAvatar prefersReducedMotion={prefersReducedMotion} />
      )}
      {/* 地面投影环 — 仅 GLB 模型模式（程序化头像自带基座光盘） */}
      {model && <HoloGround prefersReducedMotion={prefersReducedMotion} />}

      {/* 粒子：减量+暖粉，减少杂乱 */}
      <Sparkles
        count={prefersReducedMotion ? 0 : 24}
        scale={7}
        size={1.7}
        speed={0.28}
        opacity={0.38}
        color="#FFD6E6"
      />

      {/* 阴影 — 更柔。平面落在地面高度，解决切身与下半身投不上影 */}
      <ContactShadows
        position={[0, GROUND_Y - 0.01, 0]}
        resolution={1024}
        scale={10}
        blur={2.6}
        opacity={0.34}
        far={9}
        color="#2A1810"
      />

      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 2.5}
        maxPolarAngle={Math.PI / 1.8}
        enableZoom={true}
        minDistance={3}
        maxDistance={10}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        enableDamping
        makeDefault
      />
      <KeyboardControls />
    </>
  );
}
