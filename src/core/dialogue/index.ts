export {
  sendUserInput,
  streamUserInput,
  checkServerHealth,
  clearRemoteSession,
  DialogueApiError,
  resetDialogueServiceRoutingForTests,
  applyRuntimeApiEndpoints,
  resetRuntimeApiEndpoints,
  normalizeDialogueRequestPayload,
  normalizeDialogueError,
  fetchWithTimeout,
  sendDialogueHttpRequest,
  sendDialogueStreamRequest,
  parseApiEndpoints,
  evaluateConnectionRecovery,
  getDefaultChatTransport,
  getChatTransport,
  getPreferredChatTransportMode,
  setChatTransportOverride,
  httpChatTransport,
  sseChatTransport,
  createIdleDialogueTurnSnapshot,
} from './dialogueService';

export type {
  ChatRequestPayload,
  ChatResponsePayload,
  DialogueServiceResult,
  DialogueServiceConfig,
  StreamCallbacks,
  ChatTransportMode,
  ChatTransport,
  DialogueMessage,
  DialogueMessageRole,
  DialogueTurnStatus,
  DialogueTurnMode,
  DialogueTurnSnapshot,
  ConnectionRecoveryResult,
} from './dialogueService';

export { DialogueOrchestrator, handleDialogueResponse } from './dialogueOrchestrator';
export type {
  DialogueHandleOptions,
  DialogueTurnOptions,
  DialogueOrchestratorDependencies,
} from './dialogueOrchestrator';

export {
  CHARACTER_PRESETS,
  DEFAULT_CHARACTER_ID,
  getCharacterPreset,
  isValidCharacterId,
} from './characterPresets';
export type { CharacterPreset } from './characterPresets';
