import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const TRANSITION_KIND = "transition";
export const TRANSITION_VERSION = 1;
export const TRANSITION_ROW_ID = "transition";

export const FailureClassSchema = z.enum(["quota", "rate_limit", "overloaded", "manual"]);
export type FailureClass = z.output<typeof FailureClassSchema>;

export const TransitionStatusSchema = z.enum([
  "creating",
  "created",
  "failed",
  "exhausted",
  "halted",
]);
export type TransitionStatus = z.output<typeof TransitionStatusSchema>;

export const TransitionCardSchema = z.object({
  status: TransitionStatusSchema,
  reason: FailureClassSchema,
  evidence: z.string(),
  fromProvider: z.string(),
  toProvider: z.string().nullable(),
  toAgentId: z.string().nullable(),
  toTitle: z.string().nullable(),
  detail: z.string().nullable(),
  at: z.string(),
});
export type TransitionCard = z.output<typeof TransitionCardSchema>;

export const failoverNowRpc = defineRpc({
  name: "continuity.failover-now",
  input: z.object({ agentId: z.string().min(1) }),
  output: z.object({
    status: z.enum(["created", "failed", "exhausted", "halted", "skipped"]),
    newAgentId: z.string().nullable(),
    message: z.string(),
  }),
});
