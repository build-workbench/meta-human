/**
 * 语音命令处理 Hook。
 *
 * 内联解析命令字符串并执行对应动作。
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useEngine, useTTS } from '@/services';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import type { ExpressionType } from '@/core/avatar/avatarContract';

interface UseVoiceCommandHandlerOptions {
  onChatSend?: (text: string) => void;
}

const EXPRESSION_RESET_MS = 3000;
const PRESET_RESET_MS: Record<string, number> = {
  greeting: 4000,
  dance: 6000,
  nod: 2000,
  shakeHead: 2000,
};

const PRESET_SPEECH: Record<string, string> = {
  greeting: '您好！很高兴见到您！有什么可以帮助您的吗？',
  dance: '让我为您跳一支舞！',
  nod: '好的，我明白了。',
  shakeHead: '不太确定呢。',
};

function parseCommand(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const commands: Record<string, string> = {
    播放: 'play',
    开始: 'play',
    暂停: 'pause',
    停止: 'pause',
    重置: 'reset',
    复位: 'reset',
    取消静音: 'unmute',
    静音: 'mute',
    打招呼: 'greeting',
    问好: 'greeting',
    跳舞: 'dance',
    点头: 'nod',
    摇头: 'shakeHead',
    说话: 'speak',
    表情: 'expression',
  };
  return commands[trimmed] ?? null;
}

export function useVoiceCommandHandler(options: UseVoiceCommandHandlerOptions = {}) {
  const engine = useEngine();
  const tts = useTTS();
  const { onChatSend } = options;

  // 上一个动作的重置定时器：新命令先清掉，避免旧定时器把新动画打断回 idle
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVoiceCommand = useCallback(
    (command: string) => {
      const action = parseCommand(command);
      if (!action) {
        onChatSend?.(command);
        return;
      }

      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      switch (action) {
        case 'play':
          engine.play();
          break;
        case 'pause':
          engine.pause();
          break;
        case 'reset':
          engine.reset();
          break;
        case 'mute':
          useDigitalHumanStore.getState().setMuted(true);
          break;
        case 'unmute':
          useDigitalHumanStore.getState().setMuted(false);
          break;
        case 'greeting':
        case 'dance':
        case 'nod':
        case 'shakeHead': {
          const speech = PRESET_SPEECH[action];
          if (action === 'greeting') {
            engine.setEmotion('happy');
            engine.setExpression('smile');
            engine.setBehavior('greeting');
            engine.playAnimation('wave');
          } else if (action === 'dance') {
            engine.playAnimation('dance');
            engine.setBehavior('excited');
            engine.setEmotion('happy');
          } else if (action === 'nod') {
            engine.playAnimation('nod');
            engine.setBehavior('listening');
          } else {
            engine.playAnimation('shakeHead');
          }
          void tts.speak(speech).catch(() => undefined);
          toast.success(
            `执行${action === 'greeting' ? '打招呼' : action === 'dance' ? '跳舞' : action === 'nod' ? '点头' : '摇头'}动作`,
          );
          resetTimerRef.current = setTimeout(() => {
            resetTimerRef.current = null;
            engine.setEmotion('neutral');
            engine.setExpression('neutral');
            engine.setBehavior('idle');
            engine.playAnimation('idle');
          }, PRESET_RESET_MS[action]);
          break;
        }
        case 'speak':
          void tts.speak('您好！有什么可以帮助您的吗？').catch(() => undefined);
          toast.success('开始说话');
          break;
        case 'expression': {
          const expressions: ExpressionType[] = ['smile', 'surprise', 'laugh'];
          const randomExpr = expressions[Math.floor(Math.random() * expressions.length)];
          engine.setExpression(randomExpr);
          toast.success(`切换到 ${randomExpr} 表情`);
          resetTimerRef.current = setTimeout(() => {
            resetTimerRef.current = null;
            engine.setExpression('neutral');
          }, EXPRESSION_RESET_MS);
          break;
        }
        default:
          break;
      }
    },
    [engine, tts, onChatSend],
  );

  return { handleVoiceCommand };
}
