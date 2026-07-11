/**
 * 服务容器工厂与类型。
 *
 * 创建服务实例，使用集中式 adapters 与 Zustand store 交互。
 */

import { createASRStateAdapter, createEngineStateAdapter, createTTSCallbacks } from './adapters';
import { TTSService, ASRService } from './audio/audioService';
import { DigitalHumanEngine } from './avatar/DigitalHumanEngine';
import { DialogueOrchestrator } from './dialogue/dialogueOrchestrator';

export interface Services {
  engine: DigitalHumanEngine;
  tts: TTSService;
  asr: ASRService;
  dialogue: DialogueOrchestrator;
}

export function createServices(): Services {
  const ttsCallbacks = createTTSCallbacks();
  const asrStateAdapter = createASRStateAdapter();
  const engineStateAdapter = createEngineStateAdapter();

  const dialogue = new DialogueOrchestrator();
  const tts = new TTSService({}, ttsCallbacks);
  const asr = new ASRService({}, asrStateAdapter, tts, dialogue);
  const engine = new DigitalHumanEngine(engineStateAdapter);

  return { engine, tts, asr, dialogue };
}

export function disposeServices(services: Services): void {
  services.asr.dispose();
  services.tts.dispose();
  services.engine.dispose();
  services.dialogue.reset();
}

export type { TTSCallbacks, ASRStateAdapter } from './audio/audioAdapters';
export type { EngineStateAdapter } from './avatar/avatarStateAdapter';
export type { StateAdapter } from './avatar/DigitalHumanEngine';
