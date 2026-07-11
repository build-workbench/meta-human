/**
 * 3D 场景配置组件。
 *
 * 配置光照、相机、粒子和轨道控制。
 */

import * as THREE from 'three';
import {
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Sparkles,
  ContactShadows,
} from '@react-three/drei';
import { usePrefersReducedMotion } from '@/hooks';
import { CyberAvatar } from './CyberAvatar';
import { KeyboardControls } from './KeyboardControls';

interface SceneProps {
  autoRotate?: boolean;
  modelScene?: THREE.Group | null;
}

export function Scene({ autoRotate, modelScene }: SceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45} />

      {/* 光照 */}
      <ambientLight intensity={0.5} color="#ffffff" />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-10, -10, -10]} intensity={1} color="#3b82f6" />

      {/* 环境反射 */}
      <Environment preset="city" />

      {/* 数字人 */}
      {modelScene ? (
        <primitive object={modelScene} position={[0, -1.2, 0]} />
      ) : (
        <CyberAvatar prefersReducedMotion={prefersReducedMotion} />
      )}

      {/* 粒子 */}
      <Sparkles
        count={prefersReducedMotion ? 0 : 50}
        scale={8}
        size={2}
        speed={0.4}
        opacity={0.5}
        color="#bae6fd"
      />

      {/* 阴影 */}
      <ContactShadows
        resolution={1024}
        scale={10}
        blur={2}
        opacity={0.5}
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
