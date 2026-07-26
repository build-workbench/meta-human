/**
 * 对话路由：封装端点路由器与传输覆盖，替代原有模块级可变单例。
 *
 * 所有路由状态（endpointRouter、transportOverride）都收进实例，
 * 不再使用模块级 `let` 可变全局。
 */
import { useSystemStore } from '../../store/systemStore';
import { EndpointRouter, type EndpointRoutingOutcome } from './endpointRouter';
import { parseApiEndpoints } from './httpClient';
import {
  httpChatTransport,
  sseChatTransport,
  getPreferredChatTransportMode,
  type ChatTransport,
} from './transports';
import type { ChatTransportMode } from './dialogueService';

export type RecordRoutingFn = (activeEndpoint: string, didFailover: boolean) => void;

const defaultRecordRouting: RecordRoutingFn = (activeEndpoint, didFailover) => {
  useSystemStore.getState().recordEndpointRouting({ activeEndpoint, didFailover });
};

export class DialogueRouting {
  private endpointRouter: EndpointRouter;
  private transportOverride: ChatTransport | null = null;
  private readonly recordRouting: RecordRoutingFn;

  constructor(endpoints: string[], recordRouting: RecordRoutingFn = defaultRecordRouting) {
    this.endpointRouter = new EndpointRouter(endpoints);
    this.recordRouting = recordRouting;
  }

  selectPrimary(): string {
    return this.endpointRouter.selectPrimary();
  }

  getCandidates(preferred?: string): string[] {
    return this.endpointRouter.getCandidates(preferred);
  }

  reportSuccess(endpoint: string): EndpointRoutingOutcome {
    const r = this.endpointRouter.reportSuccess(endpoint);
    this.recordRouting(r.activeEndpoint, r.didFailover);
    return r;
  }

  reportFailure(endpoint: string): EndpointRoutingOutcome {
    const r = this.endpointRouter.reportFailure(endpoint);
    if (r.didFailover) this.recordRouting(r.activeEndpoint, true);
    return r;
  }

  reset(endpoint?: string): void {
    this.endpointRouter.reset(endpoint);
    this.transportOverride = null;
  }

  applyEndpoints(baseUrl: string, fallbacks: string = ''): void {
    const urls = parseApiEndpoints(baseUrl, fallbacks);
    if (urls.length > 0) {
      this.endpointRouter = new EndpointRouter(urls);
    }
  }

  setTransportOverride(transport: ChatTransport | null): void {
    this.transportOverride = transport;
  }

  getTransport(mode: ChatTransportMode = getPreferredChatTransportMode()): ChatTransport {
    if (this.transportOverride) return this.transportOverride;
    if (mode === 'http') return httpChatTransport;
    return sseChatTransport;
  }
}
