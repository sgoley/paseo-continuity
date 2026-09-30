import { providerIdOf } from "../shared/labels";
import { GLOBAL_WINDOW_MS } from "./chain";

/**
 * In-memory failover state for one plugin process. Lost on reload or daemon
 * restart; durable chain counters live in agent labels instead.
 */
export class ContinuityState {
  private readonly handled = new Set<string>();
  private readonly cooldowns = new Map<string, number>();
  private failoverTimes: number[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  /** Claims an agent for failover. Returns false if it was already claimed. */
  claim(agentId: string): boolean {
    if (this.handled.has(agentId)) {
      return false;
    }
    this.handled.add(agentId);
    return true;
  }

  release(agentId: string): void {
    this.handled.delete(agentId);
  }

  isHandled(agentId: string): boolean {
    return this.handled.has(agentId);
  }

  coolDown(provider: string, until: number): void {
    const id = providerIdOf(provider);
    this.cooldowns.set(id, Math.max(until, this.cooldowns.get(id) ?? 0));
  }

  isCoolingDown(provider: string): boolean {
    const until = this.cooldowns.get(providerIdOf(provider));
    return until !== undefined && until > this.now();
  }

  recordFailover(): void {
    this.failoverTimes.push(this.now());
  }

  recentFailovers(): number {
    const cutoff = this.now() - GLOBAL_WINDOW_MS;
    this.failoverTimes = this.failoverTimes.filter((time) => time > cutoff);
    return this.failoverTimes.length;
  }
}
