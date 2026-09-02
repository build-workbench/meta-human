/**
 * GLB 模型数字人驱动组件 — 与 CyberAvatar（程序化回退）平行的实现。
 *
 * 驱动与降级策略：
 * - 动画：优先播放模型自带剪辑（idle→Idle / nod→Yes / shakeHead→No /
 *   wave→Wave / dance→Dance），无对应剪辑（think / speak）降级为程序化整体旋转
 * - 行为：消费 behavior 通道 — thinking（等 LLM 回复）时持续歪头思考，
 *   isSpeaking（TTS 播报）时头部微摆，无需额外触发
 * - 表情：morph target 存在则驱动对应通道（见 avatarModelPrepare 的候选名表）
 * - 口型：优先 jawOpen 类 morph；模型缺失时降级写 surprise 通道 × 0.3 上限
 *   （说话时有可见嘴部反馈，又不会显得惊恐）
 * - 材质：说话时扫描线加速/边缘光增强（holo.speech）；入场时自下而上
 *   扫描显现（holo.reveal），reduced motion 直接跳过
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
  MODEL_Y_OFFSET,
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
/** 入场显现扫描时长（秒）。 */
const REVEAL_DURATION = 1.3;
/** 显现终值略超 1，保证扫描线越过头顶后全身完全可见。 */
const REVEAL_END = 1.05;
/** 注视相机强度（对相机方位角的跟随比例）与最大偏转角。 */
const GAZE_FACTOR = 0.35;
const GAZE_MAX_YAW = 0.5;

export function ModelAvatar({ model, prefersReducedMotion }: ModelAvatarProps) {
  const group = useRef<THREE.Group>(null);
  // 内层注视 group：独立于外层摆动 group，避免与 think/speak 旋转打架
  const gazeRef = useRef<THREE.Group>(null);
  // 全息嘴覆盖层（仅当模型无 jawOpen morph 时渲染）
  const mouthRef = useRef<THREE.Mesh>(null);
  const storeRef = useRef(useDigitalHumanStore.getState());
  const intensityRef = useRef(storeRef.current.expressionIntensity ?? 0.8);
  const isVisibleRef = useIsTabVisibleRef();
  // reduced motion 直接完全显现，跳过入场扫描
  const revealRef = useRef(prefersReducedMotion ? REVEAL_END : 0);

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
        currentBehavior: s.currentBehavior,
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
  // 修复：原版 `if (!clip) return;` 在切到无剪辑动作时（wave → think）早返回，
  // 旧 action 不 fadeOut，残留旋转与程序化旋转打架。改为：无论是否有剪辑都做一次
  // 旧 action 的 fadeOut，无剪辑时 next=null 即完全停下。
  const currentAnimation = useDigitalHumanStore((s) => s.currentAnimation);
  useEffect(() => {
    const clip = model.clipMap[currentAnimation] ?? null;
    let next: THREE.AnimationAction | null = null;
    if (clip) {
      next = actionsRef.current.get(currentAnimation) ?? mixer.clipAction(clip);
      if (currentAnimation !== 'idle') {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      }
      actionsRef.current.set(currentAnimation, next);
    }
    activeActionRef.current?.fadeOut(0.2);
    if (next) next.reset().fadeIn(0.2).play();
    activeActionRef.current = next;
  }, [currentAnimation, mixer, model.clipMap]);

  // 卸载 / 换 model.group 时的清理。
  // 修复：原版只 stopAllAction + uncacheRoot，但 actionsRef 是 useRef，
  // 同组件复用（custom↔builtin 切换且都是 model 时 ModelAvatar 不卸载）
  // 会让 Map 里的 action 绑在旧 mixer 上，新 mixer 命中旧 action 调 play() 静默失效。
  useEffect(() => {
    // 拷贝 actionsMap 引用与本次 action 列表，避免 cleanup 时 actionsRef 已变。
    const actionsMap = actionsRef.current;
    const active = activeActionRef.current;
    const cachedActions = Array.from(actionsMap.values());
    return () => {
      for (const action of cachedActions) {
        try {
          mixer.uncacheClip(action.getClip());
        } catch {
          // clip 已被卸载 / 跨 mixer 复用，忽略
        }
      }
      actionsMap.clear();
      if (active) active.fadeOut(0.2);
      mixer.stopAllAction();
      mixer.uncacheRoot(model.group);
    };
  }, [mixer, model.group]);

  useFrame((state, delta) => {
    if (!isVisibleRef.current) return;

    const t = state.clock.elapsedTime;
    const { currentExpression, isSpeaking, currentAnimation, currentBehavior } = storeRef.current;
    const intensity = Math.max(0, Math.min(1, intensityRef.current));

    // 全息材质驱动（材质氛围，不属于角色运动，reduced motion 下也保留）：
    // - 扫描线持续流动
    // - 说话强度平滑跟随口型（扫描线加速 + 边缘光增强）
    // - 入场显现扫描自下而上推进
    model.holo.time.value = t;
    model.holo.speech.value = THREE.MathUtils.lerp(
      model.holo.speech.value,
      mouthOpenSignal.value,
      0.25,
    );
    if (revealRef.current < REVEAL_END) {
      revealRef.current = Math.min(REVEAL_END, revealRef.current + delta / REVEAL_DURATION);
    }
    model.holo.reveal.value = revealRef.current;

    if (prefersReducedMotion && currentAnimation === 'idle' && !isSpeaking) {
      return;
    }

    mixer.update(delta);

    // 无剪辑动作/行为 → 程序化整体旋转；有剪辑时旋转回正，让位骨骼动画。
    // thinking 行为由对话编排器在等待 LLM 回复时设置，无需动画触发。
    const thinking = currentBehavior === 'thinking';
    const speaking = isSpeaking;
    if (group.current) {
      const hasClip = Boolean(model.clipMap[currentAnimation]);
      if (!hasClip && (currentAnimation === 'think' || thinking)) {
        group.current.rotation.z = Math.sin(t * 1.5) * 0.12;
        group.current.rotation.x = Math.sin(t * 0.8) * 0.08;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
      } else if (!hasClip && (currentAnimation === 'speak' || speaking)) {
        group.current.rotation.x = Math.sin(t * 3) * 0.025;
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      } else {
        group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.1);
        group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, 0, 0.1);
        group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, 0, 0.1);
      }
    }

    // 注视相机：模型正面朝 +Z，按相机方位角做小幅偏转（OrbitControls
    // 转视角/自动旋转时机器人"跟着看"）；reduced motion 下跳过
    if (gazeRef.current && !prefersReducedMotion) {
      const targetYaw = THREE.MathUtils.clamp(
        Math.atan2(state.camera.position.x, state.camera.position.z) * GAZE_FACTOR,
        -GAZE_MAX_YAW,
        GAZE_MAX_YAW,
      );
      gazeRef.current.rotation.y = THREE.MathUtils.lerp(
        gazeRef.current.rotation.y,
        targetYaw,
        0.05,
      );
    }

    // 全息嘴覆盖层：无 jawOpen morph 时的真口型降级 — 开合直接跟随口型信号。
    // 属于语音反馈而非环境运动，reduced motion 下也保持。
    const anchor = model.faceAnchor;
    if (mouthRef.current && anchor) {
      const open = mouthOpenSignal.value;
      const mesh = mouthRef.current;
      const material = mesh.material as THREE.MeshBasicMaterial;
      const targetHeight = anchor.height * (0.3 + open * 0.9);
      mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetHeight, 0.35);
      material.opacity = THREE.MathUtils.lerp(material.opacity, 0.3 + open * 0.45, 0.35);
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
        <group ref={gazeRef}>
          <primitive object={model.group} position={[0, MODEL_Y_OFFSET, 0]} />
          {/* 全息嘴覆盖层：仅当模型无 jawOpen morph 时渲染（有真 mouth morph 走 morph 驱动） */}
          {!model.morphs.mouth && model.faceAnchor && (
            <mesh
              ref={mouthRef}
              position={[
                model.faceAnchor.x,
                model.faceAnchor.y + MODEL_Y_OFFSET,
                model.faceAnchor.z,
              ]}
              scale={[
                model.faceAnchor.width,
                model.faceAnchor.height * 0.3,
                model.faceAnchor.width * 0.35,
              ]}
            >
              <sphereGeometry args={[0.5, 16, 12]} />
              <meshBasicMaterial
                color="#22d3ee"
                transparent
                opacity={0.3}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      </Float>
    </group>
  );
}
