import { useState, useCallback, useEffect, useRef } from 'react';
import { useDigitalHumanStore } from '@/store/digitalHumanStore';
import { useChatSessionStore } from '@/store/chatSessionStore';
import { useSystemStore } from '@/store/systemStore';
import { useTTS, useEngine, useDialogue } from '@/services';
import { toast } from 'sonner';
import { loggers } from '@/lib/logger';
import { createIdleDialogueTurnSnapshot } from '@/core/dialogue/dialogueService';
import { buildDialogueRequestMeta } from '@/core/dialogue/dialogueRequestMeta';

const logger = loggers.chat;

export interface UseChatStreamOptions {
  sessionId: string;
  isMuted: boolean;
  onConnectionChange: (status: 'connected' | 'error') => void;
  onClearError: () => void;
  onError: (msg: string) => void;
}

export function useChatStream(options: UseChatStreamOptions) {
  const tts = useTTS();
  const engine = useEngine();
  const dialogue = useDialogue();
  const addChatMessage = useChatSessionStore((s) => s.addChatMessage);
  const updateChatMessage = useChatSessionStore((s) => s.updateChatMessage);
  const removeChatMessage = useChatSessionStore((s) => s.removeChatMessage);
  const setLoading = useSystemStore((s) => s.setLoading);
  const setDialogueTurn = useSystemStore((s) => s.setDialogueTurn);
  const isLoading = useSystemStore((s) => s.isLoading);
  const [chatInput, setChatInput] = useState('');
  const { sessionId, isMuted, onConnectionChange, onClearError, onError } = options;
  const activeTurnRef = useRef<{
    token: symbol;
    sessionId: string;
    settleForTeardown: () => void;
  } | null>(null);

  // Ref to read chatInput without adding it to handleChatSend dependencies
  const chatInputRef = useRef(chatInput);
  chatInputRef.current = chatInput;

  useEffect(() => {
    setDialogueTurn(dialogue.getTurnSnapshot());

    const unsubscribe = dialogue.subscribeTurnSnapshot((snapshot) => {
      // Skip per-token 'streaming' snapshots to avoid store churn;
      // streaming text is handled via onStreamToken directly.
      if (snapshot.status === 'streaming') return;
      setDialogueTurn(snapshot);
    });

    return () => {
      dialogue.reset();
      activeTurnRef.current?.settleForTeardown();
      unsubscribe();
      setDialogueTurn(createIdleDialogueTurnSnapshot());
      activeTurnRef.current = null;
    };
  }, [dialogue, sessionId, setDialogueTurn]);

  const handleChatSend = useCallback(
    async (text?: string) => {
      const content = (text ?? chatInputRef.current).trim();
      if (!content) return;
      if (useSystemStore.getState().isLoading) return;

      if (!text) setChatInput('');

      let assistantMessageId: number | null = null;
      const turnSessionId = sessionId;
      const turnToken = Symbol('chat-stream-turn');

      const ownsCurrentTurn = () =>
        activeTurnRef.current?.token === turnToken &&
        activeTurnRef.current?.sessionId === turnSessionId;

      const guardTurn = <T extends (...args: never[]) => void>(fn: T): T =>
        ((...args: never[]) => {
          if (!ownsCurrentTurn()) return;
          fn(...args);
        }) as T;

      const releaseCurrentTurn = () => {
        if (ownsCurrentTurn()) {
          activeTurnRef.current = null;
        }
      };

      const finalizeAssistantMessage = (discardEmpty = false) => {
        if (!ownsCurrentTurn() || !assistantMessageId) return;

        const currentMessage = useChatSessionStore
          .getState()
          .chatHistory.find((msg) => msg.id === assistantMessageId);

        if (!currentMessage) return;

        if (currentMessage.text.trim() || !discardEmpty) {
          updateChatMessage(assistantMessageId, { isStreaming: false });
        } else {
          removeChatMessage(assistantMessageId);
        }
      };

      const syncAssistantMessageWithResult = (replyText: string) => {
        if (!ownsCurrentTurn() || !assistantMessageId) return;

        const currentMessage = useChatSessionStore
          .getState()
          .chatHistory.find((msg) => msg.id === assistantMessageId);

        if (!replyText.trim()) {
          if (currentMessage) removeChatMessage(assistantMessageId);
          return;
        }

        if (currentMessage) {
          updateChatMessage(assistantMessageId, { text: replyText, isStreaming: false });
          return;
        }

        addChatMessage('assistant', replyText);
      };

      activeTurnRef.current = {
        token: turnToken,
        sessionId: turnSessionId,
        settleForTeardown: () => finalizeAssistantMessage(true),
      };

      try {
        const runtimeState = useDigitalHumanStore.getState();

        const result = await dialogue.runDialogueTurnStream(content, {
          sessionId,
          meta: buildDialogueRequestMeta({
            timestamp: Date.now(),
            language: 'zh-CN',
            speech: runtimeState.speechConfig,
            characterId: runtimeState.activeCharacterId,
          }),
          engine,
          isMuted,
          speakWith: (textToSpeak) => tts.speak(textToSpeak),
          setLoading,
          onAddAssistantMessage: undefined,
          onAddUserMessage: guardTurn((t: string) => {
            addChatMessage('user', t);
            assistantMessageId = addChatMessage('assistant', '', true);
          }),
          onStreamToken: guardTurn((accumulatedText: string) => {
            if (assistantMessageId) {
              updateChatMessage(assistantMessageId, { text: accumulatedText, isStreaming: true });
            }
          }),
          onTurnResponse: guardTurn((response: { replyText: string }) => {
            syncAssistantMessageWithResult(response.replyText);
          }),
          onStreamEnd: guardTurn(() => finalizeAssistantMessage()),
          onConnectionChange: guardTurn((status: 'connected' | 'error') => {
            onConnectionChange(status);
          }),
          onClearError: guardTurn(() => onClearError()),
          onError: guardTurn((msg: string) => onError(msg)),
          onResetBehavior: guardTurn(() => {
            if (useDigitalHumanStore.getState().currentBehavior === 'thinking') {
              engine.setBehavior('idle');
            }
          }),
        });

        if (!result) {
          finalizeAssistantMessage(true);
          releaseCurrentTurn();
          return;
        }

        syncAssistantMessageWithResult(result.replyText);
        releaseCurrentTurn();
      } catch (err: unknown) {
        logger.error('发送消息失败:', err);
        toast.error(err instanceof Error ? err.message : '发送失败，请重试');
        finalizeAssistantMessage(true);
        releaseCurrentTurn();
      }
    },
    [
      tts,
      engine,
      addChatMessage,
      updateChatMessage,
      removeChatMessage,
      setLoading,
      sessionId,
      isMuted,
      onConnectionChange,
      onClearError,
      onError,
      dialogue,
    ],
  );

  return { chatInput, setChatInput, isChatLoading: isLoading, handleChatSend };
}
