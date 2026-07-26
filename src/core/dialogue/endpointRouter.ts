/**
 * 端点路由器。
 *
 * 在多个 API 端点之间维护活跃端点，并在失败时进行故障转移。
 * 纯运行时工具，不持有任何模块级可变状态。
 */

export interface EndpointRoutingOutcome {
  activeEndpoint: string;
  didFailover: boolean;
}

export class EndpointRouter {
  private readonly endpoints: string[];
  private activeEndpoint: string;

  constructor(endpoints: string[]) {
    const unique = Array.from(new Set(endpoints.filter(Boolean)));
    this.endpoints = unique.length > 0 ? unique : ['http://localhost:8000'];
    this.activeEndpoint = this.endpoints[0];
  }

  selectPrimary(): string {
    return this.activeEndpoint;
  }

  getCandidates(preferred?: string): string[] {
    if (preferred && this.endpoints.includes(preferred)) {
      return [preferred, ...this.endpoints.filter((e) => e !== preferred)];
    }
    return [this.activeEndpoint, ...this.endpoints.filter((e) => e !== this.activeEndpoint)];
  }

  reportSuccess(endpoint: string): EndpointRoutingOutcome {
    if (!this.endpoints.includes(endpoint)) {
      return { activeEndpoint: this.activeEndpoint, didFailover: false };
    }
    const didFailover = endpoint !== this.activeEndpoint;
    this.activeEndpoint = endpoint;
    return { activeEndpoint: this.activeEndpoint, didFailover };
  }

  reportFailure(endpoint: string): EndpointRoutingOutcome {
    if (endpoint !== this.activeEndpoint) {
      return { activeEndpoint: this.activeEndpoint, didFailover: false };
    }
    const next = this.endpoints.find((e) => e !== endpoint);
    if (!next) return { activeEndpoint: this.activeEndpoint, didFailover: false };
    this.activeEndpoint = next;
    return { activeEndpoint: this.activeEndpoint, didFailover: true };
  }

  reset(endpoint?: string): void {
    if (endpoint && this.endpoints.includes(endpoint)) {
      this.activeEndpoint = endpoint;
      return;
    }
    this.activeEndpoint = this.endpoints[0];
  }
}
