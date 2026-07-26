/**
 * 对话模块统一公共导出。
 *
 * 现有调用方仍从 `@/core/dialogue/dialogueService` 直接导入；
 * 本 barrel 提供面向未来的聚合导出点。
 */

export type {
  DialogueMessageRole,
  DialogueMessage,
  ChatRequestPayload,
  ChatResponsePayload,
  DialogueServiceResult,
  DialogueServiceConfig,
  StreamCallbacks,
  ChatTransportMode,
} from './dialogueService';

export {
  DialogueApiError,
  fetchWithTimeout,
  sendDialogueHttpRequest,
  sendDialogueStreamRequest,
  normalizeDialogueError,
  isRetryableDialogueError,
  shouldAbort,
  classifyAttemptError,
  normalizeApiEndpoint,
  parseApiEndpoints,
  validateApiUrl,
  parseChatResponse,
  getLatestUserMessage,
} from './httpClient';

export type { ChatTransport } from './transports';
export { httpChatTransport, sseChatTransport, getPreferredChatTransportMode } from './transports';

export type { ConnectionRecoveryResult } from './connectionRecovery';
export { evaluateConnectionRecovery } from './connectionRecovery';

export { EndpointRouter } from './endpointRouter';
export type { EndpointRoutingOutcome } from './endpointRouter';

export { DialogueRouting } from './dialogueRouting';
export type { RecordRoutingFn } from './dialogueRouting';

export {
  sendUserInput,
  streamUserInput,
  checkServerHealth,
  clearRemoteSession,
  normalizeDialogueRequestPayload,
  getChatTransport,
  getDefaultChatTransport,
  setChatTransportOverride,
  applyRuntimeApiEndpoints,
  resetRuntimeApiEndpoints,
  resetDialogueServiceRoutingForTests,
  configureDialogueRouting,
  createDefaultDialogueRouting,
} from './dialogueService';

export type {
  DialogueTurnStatus,
  DialogueTurnMode,
  DialogueTurnSnapshot,
} from './dialogueTurnSnapshot';
export { createIdleDialogueTurnSnapshot } from './dialogueTurnSnapshot';
