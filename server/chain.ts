import { LABEL, providerIdOf } from "../shared/labels";
import type { ChainEntry, ContinuitySettings } from "../shared/settings";

export interface ChainPosition {
  chainId: string;
  sequence: number;
  consecutive: number;
}

/** Reads chain position from the failed agent's labels; an unlabeled agent starts a new chain. */
export function chainPositionFromLabels(
  agentId: string,
  labels: Readonly<Record<string, string>> | null | undefined,
): ChainPosition {
  const chainId = labels?.[LABEL.chainId];
  if (!chainId) {
    return { chainId: agentId, sequence: 0, consecutive: 0 };
  }
  return {
    chainId,
    sequence: toCount(labels[LABEL.sequence]),
    consecutive: toCount(labels[LABEL.consecutive]),
  };
}

function toCount(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export type BreakerVerdict = { ok: true } | { ok: false; reason: string };

export const GLOBAL_WINDOW_MS = 10 * 60_000;
export const GLOBAL_MAX_FAILOVERS = 5;

export function checkBreaker(input: {
  position: ChainPosition;
  /** Whether the failed agent did useful work after its own handoff prompt. */
  madeProgress: boolean;
  settings: Pick<ContinuitySettings, "maxSwitchesPerChain" | "maxConsecutiveFailovers"> & {
    chainLength?: number;
  };
  recentFailovers: number;
}): BreakerVerdict {
  const { position, madeProgress, settings, recentFailovers } = input;
  if (position.sequence >= settings.maxSwitchesPerChain) {
    return {
      ok: false,
      reason: `Chain already switched ${position.sequence} times (limit ${settings.maxSwitchesPerChain}).`,
    };
  }
  const consecutive = madeProgress ? 0 : position.consecutive;
  const consecutiveLimit =
    settings.chainLength !== undefined && settings.chainLength > 0
      ? Math.min(settings.maxConsecutiveFailovers, settings.chainLength)
      : settings.maxConsecutiveFailovers;
  if (consecutive >= consecutiveLimit) {
    return {
      ok: false,
      reason: `${consecutive} consecutive failovers without progress (limit ${consecutiveLimit}).`,
    };
  }
  if (recentFailovers >= GLOBAL_MAX_FAILOVERS) {
    return {
      ok: false,
      reason: `${recentFailovers} failovers on this host in the last 10 minutes (limit ${GLOBAL_MAX_FAILOVERS}).`,
    };
  }
  return { ok: true };
}

export function nextConsecutive(position: ChainPosition, madeProgress: boolean): number {
  return (madeProgress ? 0 : position.consecutive) + 1;
}

/**
 * Identity of a chain entry for failover: provider/model when a model is set,
 * provider alone otherwise. Lets one provider appear several times with
 * different models (e.g. omp fronting several backends).
 */
export function entryKey(provider: string, model?: string | null): string {
  const id = providerIdOf(provider);
  return model ? `${id}/${model}`.toLowerCase() : id;
}

/**
 * Picks the first eligible chain entry after the current provider, wrapping around.
 * The current provider+model itself is never picked; the same provider with a
 * different model is allowed.
 * isCoolingDown receives the composite entry key; isAvailable the provider id.
 */
export function pickNextEntry(input: {
  currentProvider: string;
  chain: readonly ChainEntry[];
  isCoolingDown: (key: string) => boolean;
  isAvailable: (provider: string) => boolean;
}): ChainEntry | null {
  const current = input.currentProvider.trim().toLowerCase();
  const currentProviderId = providerIdOf(current);
  const { chain } = input;
  if (chain.length === 0) {
    return null;
  }
  const position = chain.findIndex(
    (entry) =>
      entryKey(entry.provider, entry.model) === current ||
      (!entry.model && providerIdOf(entry.provider) === currentProviderId),
  );
  const start = position === -1 ? 0 : position + 1;
  for (let offset = 0; offset < chain.length; offset += 1) {
    const entry = chain[(start + offset) % chain.length]!;
    const provider = providerIdOf(entry.provider);
    if (provider === currentProviderId && (!entry.model || entryKey(entry.provider, entry.model) === current))
      continue;
    if (input.isCoolingDown(entryKey(entry.provider, entry.model))) continue;
    if (!input.isAvailable(provider)) continue;
    return entry;
  }
  return null;
}
