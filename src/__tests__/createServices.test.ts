import { describe, expect, it, afterEach, vi } from 'vitest';
import { createServices, disposeServices, type Services } from '@/core/createServices';
import { resetDialogueServiceRoutingForTests } from '@/core/dialogue/dialogueService';
import { DigitalHumanEngine } from '@/core/avatar/DigitalHumanEngine';
import { TTSService, ASRService } from '@/core/audio/audioService';
import { DialogueOrchestrator } from '@/core/dialogue/dialogueOrchestrator';

describe('createServices', () => {
  afterEach(() => {
    // 工厂会通过 configureDialogueRouting 注入默认路由，测试后复位模块级单例
    resetDialogueServiceRoutingForTests();
  });

  it('assembles the four runtime services and a routing instance', () => {
    const services = createServices();

    expect(services.engine).toBeInstanceOf(DigitalHumanEngine);
    expect(services.tts).toBeInstanceOf(TTSService);
    expect(services.asr).toBeInstanceOf(ASRService);
    expect(services.dialogue).toBeInstanceOf(DialogueOrchestrator);
    expect(services.routing).toBeDefined();
  });

  it('wires the orchestrator to the injected routing via getChatTransport', () => {
    const services = createServices();
    // 工厂以 () => routing.getTransport() 注入，orchestrator 默认走注入的 routing
    const transport = services.dialogue['getChatTransport']();
    expect(transport).toBeDefined();
    expect(['http', 'sse']).toContain(transport.mode);
  });

  it('disposeServices disposes asr, tts, engine and resets dialogue in order', () => {
    const order: string[] = [];
    const fake: Services = {
      asr: { dispose: vi.fn(() => order.push('asr')) } as unknown as Services['asr'],
      tts: { dispose: vi.fn(() => order.push('tts')) } as unknown as Services['tts'],
      engine: { dispose: vi.fn(() => order.push('engine')) } as unknown as Services['engine'],
      dialogue: { reset: vi.fn(() => order.push('dialogue')) } as unknown as Services['dialogue'],
    };

    disposeServices(fake);

    expect(order).toEqual(['asr', 'tts', 'engine', 'dialogue']);
    expect(fake.asr.dispose).toHaveBeenCalledTimes(1);
    expect(fake.tts.dispose).toHaveBeenCalledTimes(1);
    expect(fake.engine.dispose).toHaveBeenCalledTimes(1);
    expect(fake.dialogue.reset).toHaveBeenCalledTimes(1);
  });
});
