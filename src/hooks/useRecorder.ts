/**
 * 统一录音 hook。
 *
 * 管理 ASRService 的唯一 React 入口：顶栏、聊天坞、设置面板的录音按钮
 * 都经由它调用 asr.start/stop，避免多个 hook 各自启动识别导致回调互相覆盖。
 * ASRService 是单例服务，生命周期由 ServicesProvider 的 disposeServices 管理，
 * 因此组件卸载时不停识别（关闭设置面板不得中断其他入口发起的录音）。
 */

import { useCallback, useRef } from 'react';
import { useASR } from '@/services';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';

export interface UseRecorderOptions {
  /** 识别出最终文本时回调 */
  onTranscript?: (text: string) => void;
}

export interface RecorderControls {
  isRecording: boolean;
  /** 启动识别，返回是否成功启动 */
  startRecording: (mode?: 'command' | 'dictation') => boolean;
  stopRecording: () => void;
  /** 切换录音状态，返回 true 表示开始、false 表示停止 */
  toggleRecording: (mode?: 'command' | 'dictation') => boolean;
}

export function useRecorder(options: UseRecorderOptions = {}): RecorderControls {
  const asr = useASR();
  const isRecording = useDigitalHumanStore((s) => s.isRecording);
  const setRecording = useDigitalHumanStore((s) => s.setRecording);

  // ref 化回调：切换回调时不必重启识别
  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;

  const startRecording = useCallback(
    (mode?: 'command' | 'dictation'): boolean =>
      asr.start({
        mode,
        onResult: (text: string) => onTranscriptRef.current?.(text),
      }),
    [asr],
  );

  const stopRecording = useCallback(() => {
    asr.stop();
    setRecording(false);
  }, [asr, setRecording]);

  const toggleRecording = useCallback(
    (mode?: 'command' | 'dictation'): boolean => {
      if (useDigitalHumanStore.getState().isRecording) {
        stopRecording();
        return false;
      }
      return startRecording(mode);
    },
    [startRecording, stopRecording],
  );

  return { isRecording, startRecording, stopRecording, toggleRecording };
}
