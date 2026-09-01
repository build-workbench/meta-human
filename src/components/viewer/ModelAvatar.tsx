/**
 * GLB 模型数字人驱动组件 — 与 CyberAvatar（程序化回退）平行的实现。
 *
 * 驱动与降级策略：
 * - 动画：优先播放模型自带剪辑（idle→Idle / nod→Yes / shakeHead→No /
 *   wave→Wave / dance→Dance），无对应剪辑（think / speak）降级为程序化整体旋转
 * - 表情：morph target 存在则驱动对应通道（见 avatarModelPrepare 的候选名表）
 * - 口型：优先 jawOpen 类 morph；模型缺失时降级写 surprise 通道 × 0.3 上限
 *   （说话时有可见嘴部反馈，又不会显得惊恐）
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { shallow } from 'zustand/shallow';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { mouthOpenSignal } from '@/core/avatar/mouthOpenSignal';
import { useIsTabVisibleRef } from '@/hooks';
import {
  EXPRESSION_TO_MORPH_CHANNEL,
  type MorphChannel,
  type PreparedAvatarModel,
} from '@/core/avatar/avatarModelPrepare';

interface ModelAvatarProps {
  model: PreparedAvatarModel;
  prefersReducedMotion: boolean;
}

/** 无 jawOpen 时的口型降级上限（借 surprise 形变模拟说话张嘴）。 */
const MOUTH_FALLBACK_MAX = 0.3;
const MORPH_LERP = 0.2;

export function ModelAvatar({ model, prefersReducedMotion }: ModelAvatarProps) {
  const group = useRef<THREE.Group>(null);
  const storeRef = useRef(useDigitalHumanStore.getState());
  const intensityRef = useRef(storeRef.current.expressionIntensity ?? 0.8);
  const isVisibleRef = useIsTabVisibleRef();

  const mixer = useMemo(() => new THREE.AnimationMixer(model.group), [model.group]);
  const actionsRef = useRef(new Map<string, THREE.AnimationAction>());
  const activeActionRef = useRef<THREE.AnimationAction | null>(null);

  // 与 CyberAvatar 相同的订阅模式：useFrame 内读 ref，避免高频重渲染
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

  // 剪辑切换（低频事件，走 React 订阅触发；0.2s 交叉淡化）
  const currentAnimation = useDigitalHumanStore((s) => s.currentAnimation);
  useEffect(() => {
    const clip = model.clipMap[currentAnimation];
    if (!clip) return; // 无剪辑 → useFrame 内程序化旋转降级

    let action = actionsRef.current.get(currentAnimation);
    if (!action) {
      action = mixer.clipAction(clip);
      if (currentAnimation !== 'idle') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actionsRef.current.set(currentAnimation, action);
    }
    activeActionRef.current?.fadeOut(0.2);
    action.reset().fadeIn(0.2).play();
    activeActionRef.current = action;
  }, [currentAnimation, mixer, model.clipMap]);

  // 卸载清理
  useEffect(() => {
    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(model.group);
    };
  }, [mixer, model.group]);

  useFrame((state, delta) => {
    if (!isVisibleRef.current) return;

    // 全息扫描线持续流动（材质氛围，不属于角色运动，reduced motion 下也保留）
    model.timeUniform.value = state.clock.elapsedTime;

    const t = state.clock.elapsedTime;
    const { currentExpression, isSpeaking, currentAnimation } = storeRef.current;
    const intensity = Math.max(0, Math.min(1, intensityRef.current));

    if (prefersReducedMotion && currentAnimation === 'idle' && !isSpeaking) {
      return;
    }

    mixer.update(delta);

    // 无剪辑动作（think/speak）→ 程序化整体旋转；有剪辑时旋转回正，让位骨骼动画
    if (group.current) {
      const hasClip = Boolean(model.clipMap[currentAnimation]);
      if (!hasClip && currentAnimation === 'think') {
        group.current.rotation.z = Math.sin(t * 1.5) * 0.12;
        group.current.rotation.x = Math.sin(t * 0.8) * 0.08;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      } else if (!hasClip && currentAnimation === 'speak') {
        group.current.rotation.x = Math.sin(t * 3) * 0.025;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else {
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      }
    }

    // morph：表情通道 + 口型（无 jawOpen 时降级写 surprise × 0.3）
    const expressionChannel = EXPRESSION_TO_MORPH_CHANNEL[currentExpression];
    for (const channel of Object.keys(model.morphs) as MorphChannel[]) {
      const bindings = model.morphs[channel];
      if (!bindings) continue;

      let target = expressionChannel === channel ? intensity : 0;
      if (channel === 'mouth') {
        target = Math.max(target, mouthOpenSignal.value);
      } else if (channel === 'surprise' && !model.morphs.mouth) {
        target = Math.max(target, mouthOpenSignal.value * MOUTH_FALLBACK_MAX);
      }

      for (const { mesh, index } of bindings) {
        const influences = mesh.morphTargetInfluences;
        if (!influences) continue;
        influences[index] = THREE.MathUtils.lerp(influences[index] ?? 0, target, MORPH_LERP);
      }
    }
  });

  return (
    <group ref={group}>
      <Float
        speed={prefersReducedMotion ? 0 : 0.9}
        rotationIntensity={0.04}
        floatIntensity={prefersReducedMotion ? 0 : 0.22}
      >
        <primitive object={model.group} position={[0, -1.2, 0]} />
      </Float>
    </group>
  );
}
