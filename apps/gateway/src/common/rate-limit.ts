import { HttpException, Inject, Injectable } from '@nestjs/common';
import { GATEWAY_CONFIG } from '../config/gateway.config';
import type { GatewayConfig } from '../config/gateway.config';

@Injectable()
export class RateLimiter {
  private readonly counters = new Map<
    string,
    { count: number; expires: number }
  >();
  constructor(@Inject(GATEWAY_CONFIG) private readonly config: GatewayConfig) {}
  consume(
    dimension: 'ip' | 'user' | 'organization',
    identity: string,
    endpointClass = 'all',
    now = Date.now(),
  ): number {
    // Bounded memory. Never evict an active quota to admit attacker-controlled keys.
    for (const [key, counter] of this.counters)
      if (counter.expires <= now) this.counters.delete(key);
    const key = `${dimension}:${endpointClass}:${identity}`;
    let counter = this.counters.get(key);
    if (!counter) {
      if (this.counters.size >= this.config.rateMaxKeys)
        return Math.ceil(this.config.rateWindowMs / 1000);
      counter = { count: 0, expires: now + this.config.rateWindowMs };
      this.counters.set(key, counter);
    }
    const limit =
      dimension === 'ip'
        ? this.config.rateIp
        : dimension === 'user'
          ? this.config.rateUser
          : this.config.rateOrganization;
    if (counter.count >= limit)
      return Math.max(1, Math.ceil((counter.expires - now) / 1000));
    counter.count++;
    return 0;
  }
}
export function rateError() {
  return new HttpException('Rate limited', 429);
}
