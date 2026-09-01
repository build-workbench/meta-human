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

      {/* 光照 — 暖白主光 + 柔和补光，适配奶白哑光头像 */}
      <ambientLight intensity={0.85} color="#ffffff" />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.6} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#7aa3d6" />

      {/* 环境反射：程序化光带，离线可用（不依赖外部 CDN 的 HDR 预设） */}
      <Environment resolution={256}>
        {/* 顶部主光带 */}
        <Lightformer
          intensity={1.5}
          color="#ffffff"
          rotation-x={Math.PI / 2}
          position={[0, 5, 0]}
          scale={[10, 10, 1]}
        />
        {/* 前方主色调光带 */}
        <Lightformer
          intensity={1.2}
          color="#38bdf8"
          rotation-y={Math.PI}
          position={[0, 1, 5]}
          scale={[8, 3, 1]}
        />
        {/* 左右侧补光 */}
        <Lightformer
          intensity={0.8}
          color="#0ea5e9"
          rotation-y={-Math.PI / 2}
          position={[-5, 1, -1]}
          scale={[6, 2, 1]}
        />
        <Lightformer
          intensity={0.6}
          color="#3b82f6"
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

      {/* 粒子 — 极简，防抢戏 */}
      <Sparkles
        count={prefersReducedMotion ? 0 : 10}
        scale={8}
        size={1.5}
        speed={0.3}
        opacity={0.35}
        color="#dbe8ff"
      />

      {/* 阴影 — 更柔。平面必须落在地面高度：深度相机从平面向上采集，
          放在 y=0 会横穿身体且下半身投不上影 */}
      <ContactShadows
        position={[0, GROUND_Y - 0.01, 0]}
        resolution={1024}
        scale={10}
        blur={4}
        opacity={0.28}
        far={10}
        color="#000000"
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
