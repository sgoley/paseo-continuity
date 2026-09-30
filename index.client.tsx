import type { PluginClientContext } from "@getpaseo/plugin/client";
import { ChainPanel } from "./client/chain-panel";
import { SettingsScreen } from "./client/settings-screen";
import { TransitionCard } from "./client/transition-card";
import {
  TRANSITION_KIND,
  TRANSITION_VERSION,
  TransitionCardSchema,
  failoverNowRpc,
} from "./shared/contracts";

export default function contribute(client: PluginClientContext) {
  client.addTimelineRenderer({
    kind: TRANSITION_KIND,
    version: TRANSITION_VERSION,
    schema: TransitionCardSchema,
    Component: TransitionCard,
  });

  client.addWorkspacePanel({
    id: "chain",
    title: "Continuity chain",
    icon: "Link",
    context: "agent",
    Component: ChainPanel,
  });

  client.addSettingsScreen({
    id: "settings",
    title: "Paseo Continuity",
    icon: "Link",
    Component: SettingsScreen,
  });

  client.addCommandCenterItem({
    id: "open-chain",
    title: "Continuity: show chain",
    icon: "Link",
    keywords: ["continuity", "handoff", "provider", "fallback"],
    context: "agent",
    onSelect({ openPanel }) {
      openPanel("chain");
    },
  });

  client.addCommandCenterItem({
    id: "failover-now",
    title: "Continuity: switch to next provider now",
    icon: "ArrowRightLeft",
    keywords: ["continuity", "failover", "quota", "rate limit"],
    context: "agent",
    async onSelect({ agent, rpc, openPanel }) {
      const result = await rpc(failoverNowRpc, { agentId: agent.id });
      if (result.status !== "created") throw new Error(result.message);
      openPanel("chain");
    },
  });

  client.addCommandCenterItem({
    id: "settings",
    title: "Continuity: settings",
    icon: "Settings",
    context: "global",
    onSelect({ openSettings }) {
      openSettings("settings");
    },
  });

  client.addSlashCommand({
    name: "continuity",
    description: "Continue this task on the next provider in the fallback chain",
    argumentHint: "",
    context: "agent",
    async onSubmit({ agent, rpc, openPanel }) {
      const result = await rpc(failoverNowRpc, { agentId: agent.id });
      if (result.status !== "created") throw new Error(result.message);
      openPanel("chain");
    },
  });

  return () => {};
}
