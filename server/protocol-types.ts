import type { PluginHookContext, PluginLifecycleEvents } from "@getpaseo/plugin/server";

/**
 * Re-exported from the plugin SDK surface instead of `@getpaseo/protocol`
 * and `@getpaseo/client`: those packages are devDependencies, so a Git or
 * local install without `node_modules` fails the bundler's type-dependency
 * check. The SDK is host-provided and always matches the daemon's types.
 */
export type PaseoApi = PluginHookContext["paseo"];

export type AgentTimelineItem = PluginLifecycleEvents["agent.turn_ended"]["timeline"][number];

export type ToolCallDetail = Extract<AgentTimelineItem, { type: "tool_call" }>["detail"];
