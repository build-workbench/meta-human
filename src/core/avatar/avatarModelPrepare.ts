/**
 * GLB 头像模型装载预处理 — 纯 three 工具（core 层，禁止引入 React）。
 *
 * 职责：
 * - 归一化：任意来源模型统一缩放到 TARGET_HEIGHT 并居中到 (0, CENTER_Y, 0)，
 *   配合 ModelAvatar 内 primitive 偏移 [0, -1.2, 0] 落到视口中心
 * - 全息材质覆盖：MeshStandardMaterial + onBeforeCompile 注入 Fresnel 边缘光
 *   与扫描线（蒙皮/阴影/环境光走标准管线，不受影响）
 * - 能力探测：扫描 morph target 候选名、解析可用动画剪辑，供 ModelAvatar 驱动；
 *   探测不到的通道由调用方降级（AGENTS.md 规则 4）
 */
import * as THREE from 'three';
import type { ExpressionType } from './avatarContract';

/** 归一化后模型高度（世界单位）。CyberAvatar 视觉跨度约 2.3，保持接近。 */
export const TARGET_HEIGHT = 2.4;
/** 归一化后包围盒中心的本地 Y（primitive 偏移 MODEL_Y_OFFSET 后世界 Y ≈ -0.1）。 */
export const CENTER_Y = 1.1;
/** primitive 在场景中的 Y 偏移（ModelAvatar 与显现范围共用的单一来源）。 */
export const MODEL_Y_OFFSET = -1.2;
/** 显现扫描范围超出包围盒的安全余量（Float 浮动 + 骨骼动作抬升）。 */
const REVEAL_MARGIN = 0.6;

export type MorphChannel = 'angry' | 'surprise' | 'sad' | 'smile' | 'laugh' | 'mouth';

/** 表情通道 → morph target 候选名（全小写匹配，兼容 jawOpen/JawOpen 等命名差异）。 */
const MORPH_CANDIDATES: Record<MorphChannel, readonly string[]> = {
  angry: ['angry'],
  surprise: ['surprised', 'surprise'],
  sad: ['sad'],
  smile: ['smile', 'happy'],
  laugh: ['laugh'],
  mouth: ['jawopen', 'mouthopen', 'mouth_open'],
};

const MORPH_CHANNELS = Object.keys(MORPH_CANDIDATES) as MorphChannel[];

/** 表情 → morph 通道。blink/eyebrow_raise 等无对应通道时静默降级。 */
export const EXPRESSION_TO_MORPH_CHANNEL: Partial<Record<ExpressionType, MorphChannel>> = {
  angry: 'angry',
  surprise: 'surprise',
  sad: 'sad',
  smile: 'smile',
  laugh: 'laugh',
  mouth_open: 'mouth',
};

/** 动作名 → GLB 动画剪辑名。模型里不存在的剪辑自动缺席（think/speak 无剪辑，走程序化降级）。 */
export const ANIMATION_CLIP_CANDIDATES: Record<string, string> = {
  idle: 'Idle',
  nod: 'Yes',
  shakeHead: 'No',
  wave: 'Wave',
  waveHand: 'Wave',
  greet: 'Wave',
  raiseHand: 'ThumbsUp',
  dance: 'Dance',
};

export interface TimeUniform {
  value: number;
}

/** 全息材质的共享驱动 uniforms（ModelAvatar 每帧写入，全部材质实例共享）。 */
export interface HologramUniforms {
  /** 时间（扫描线流动）。 */
  time: TimeUniform;
  /** 说话强度 0..1（扫描线加速 + 边缘光增强）。 */
  speech: TimeUniform;
  /** 显现进度 0..1（入场时自下而上扫描聚合）。 */
  reveal: TimeUniform;
}

/**
 * 全息材质：深蓝基底 + 青色 Fresnel 边缘光 + 流动扫描线。
 * 通过 onBeforeCompile 注入标准管线，蒙皮（skinning）、morph、阴影、
 * 环境反射全部保持可用；uniforms 为共享引用，驱动方每帧只更新一次。
 *
 * 两段注入位于 fragment main() 同一作用域：alphamap 段计算 holoRevealY/holoVis
 * （alpha 裁剪），emissive 段复用（显现扫描亮边）；chunk 顺序 alphamap_fragment
 * 先于 emissivemap_fragment。
 */
export function createHologramMaterial(
  uniforms: HologramUniforms,
  revealRange: { minY: number; maxY: number },
): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0e1a2b'),
    emissive: new THREE.Color('#0af0ff'),
    emissiveIntensity: 0.12,
    roughness: 0.35,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    depthWrite: true,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.time;
    shader.uniforms.uSpeech = uniforms.speech;
    shader.uniforms.uReveal = uniforms.reveal;
    shader.uniforms.uRevealMinY = { value: revealRange.minY };
    shader.uniforms.uRevealMaxY = { value: revealRange.maxY };
    shader.uniforms.uRimColor = { value: new THREE.Color('#22d3ee') };
    shader.uniforms.uRimStrength = { value: 1.6 };
    shader.uniforms.uRimPower = { value: 2.5 };
    shader.uniforms.uScanFreq = { value: 14 };
    shader.uniforms.uScanSpeed = { value: 2.2 };
    shader.uniforms.uScanStrength = { value: 0.35 };

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHoloPos;')
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
        vHoloPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vHoloPos;
        uniform float uTime;
        uniform float uSpeech;
        uniform float uReveal;
        uniform float uRevealMinY;
        uniform float uRevealMaxY;
        uniform vec3 uRimColor;
        uniform float uRimStrength;
        uniform float uRimPower;
        uniform float uScanFreq;
        uniform float uScanSpeed;
        uniform float uScanStrength;`,
      )
      .replace(
        '#include <alphamap_fragment>',
        `#include <alphamap_fragment>
        float holoRevealY = uRevealMinY + uReveal * (uRevealMaxY - uRevealMinY);
        float holoVis = 1.0 - smoothstep(holoRevealY - 0.02, holoRevealY + 0.14, vHoloPos.y);
        diffuseColor.a *= holoVis * clamp(uReveal * 3.0, 0.0, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float holoFresnel = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), uRimPower);
        float holoScan = 0.5 + 0.5 * sin(vHoloPos.y * uScanFreq - uTime * uScanSpeed * (1.0 + uSpeech * 1.8));
        totalEmissiveRadiance += uRimColor * (
          holoFresnel * uRimStrength * (1.0 + uSpeech * 0.5) +
          holoScan * uScanStrength * (1.0 + uSpeech * 0.8));
        float holoEdgeBand = clamp(1.0 - abs(vHoloPos.y - holoRevealY) * 7.0, 0.0, 1.0);
        totalEmissiveRadiance += uRimColor * holoEdgeBand * (1.0 - uReveal) * 2.5;`,
      );
  };

  return material;
}

export interface MorphBinding {
  mesh: THREE.Mesh;
  index: number;
}

/** 面部锚点（容器局部坐标）：无 jawOpen morph 时的全息嘴覆盖层定位依据。 */
export interface FaceAnchor {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

export interface PreparedAvatarModel {
  /** 包了一层容器的模型根（归一化变换作用在内层 scene 上）。 */
  group: THREE.Group;
  /** 探测到的 morph 通道绑定；缺失通道即降级信号。 */
  morphs: Partial<Record<MorphChannel, MorphBinding[]>>;
  /** 动作名 → 模型内实际存在的剪辑；缺失动作即降级信号。 */
  clipMap: Partial<Record<string, THREE.AnimationClip>>;
  /** 全息材质共享驱动 uniforms，驱动方每帧写入。 */
  holo: HologramUniforms;
  /** 面部锚点：由表情 morph 所在网格的包围盒推导；无 morph 网格时缺省。 */
  faceAnchor?: FaceAnchor;
}

export function prepareAvatarModel(
  scene: THREE.Group,
  animations: THREE.AnimationClip[],
): PreparedAvatarModel {
  // 归一化：包一层容器，不污染模型自身变换语义
  const container = new THREE.Group();
  container.add(scene);

  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = size.y > 0 ? TARGET_HEIGHT / size.y : 1;
  scene.scale.setScalar(scale);
  // 缩放后原包围盒中心变为 center * scale，平移到目标中心 (0, CENTER_Y, 0)
  scene.position.set(-center.x * scale, CENTER_Y - center.y * scale, -center.z * scale);

  // 全息材质覆盖（共享一个材质实例；旧材质统一释放，几何体不动）
  const holo: HologramUniforms = {
    time: { value: 0 },
    speech: { value: 0 },
    reveal: { value: 0 },
  };
  // 显现扫描的世界 Y 范围：归一化包围盒 + primitive 偏移 + 动作安全余量
  const half = TARGET_HEIGHT / 2;
  const revealRange = {
    minY: CENTER_Y - half + MODEL_Y_OFFSET - REVEAL_MARGIN,
    maxY: CENTER_Y + half + MODEL_Y_OFFSET + REVEAL_MARGIN,
  };
  const holoMaterial = createHologramMaterial(holo, revealRange);
  const disposed = new Set<THREE.Material>();
  const morphs: Partial<Record<MorphChannel, MorphBinding[]>> = {};

  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material instanceof THREE.Material && !disposed.has(material)) {
        disposed.add(material);
        material.dispose();
      }
    }
    mesh.material = holoMaterial;

    const dictionary = mesh.morphTargetDictionary;
    if (!dictionary || !mesh.morphTargetInfluences) return;
    for (const [name, index] of Object.entries(dictionary)) {
      const lower = name.toLowerCase();
      for (const channel of MORPH_CHANNELS) {
        if (MORPH_CANDIDATES[channel].includes(lower)) {
          (morphs[channel] ??= []).push({ mesh, index });
        }
      }
    }
  });

  const clipMap: Partial<Record<string, THREE.AnimationClip>> = {};
  for (const [animation, clipName] of Object.entries(ANIMATION_CLIP_CANDIDATES)) {
    const clip = animations.find((a) => a.name === clipName);
    if (clip) clipMap[animation] = clip;
  }

  // 面部锚点：取表情 morph 所在网格（即"头部"）的包围盒，锚定下颌区域。
  // 用于无 jawOpen morph 时的全息嘴覆盖层；有真 mouth morph 的模型不需要。
  let faceAnchor: FaceAnchor | undefined;
  const morphMesh = morphs.angry?.[0]?.mesh ?? morphs.surprise?.[0]?.mesh ?? morphs.sad?.[0]?.mesh;
  if (morphMesh) {
    const mbox = new THREE.Box3().setFromObject(morphMesh);
    const msize = mbox.getSize(new THREE.Vector3());
    if (msize.y > 0) {
      faceAnchor = {
        x: 0,
        y: mbox.min.y + msize.y * 0.24,
        z: mbox.max.z + 0.01,
        width: msize.x * 0.26,
        height: msize.y * 0.18,
      };
    }
  }

  return { group: container, morphs, clipMap, holo, faceAnchor };
}
