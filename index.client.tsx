import type { PluginButtonRegistration, PluginClientContext } from "@getpaseo/plugin/client";
import { ChainPanel } from "./client/chain-panel";
import { SettingsScreen } from "./client/settings-screen";
import { TransitionCard } from "./client/transition-card";
import {
  TRANSITION_KIND,
  TRANSITION_VERSION,
  TransitionCardSchema,
  failoverNowRpc,
  getSettingsRpc,
} from "./shared/contracts";
import type { ContinuitySettings } from "./shared/settings";

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

  // Composer pills management
  const pills = new Map<string, PluginButtonRegistration>();
  const lifetime = new AbortController();

  let cachedSettings: ContinuitySettings | null = null;
  const updatePillVisibility = (settings: ContinuitySettings) => {
    cachedSettings = settings;
    const visible = settings.enabled && settings.showComposerPill;
    for (const pill of pills.values()) {
      pill.update({ visible });
    }
  };

  const registerPill = (agent: { id: string; workspaceId?: string | null }) => {
    if (lifetime.signal.aborted || !agent.workspaceId) return;
    const agentId = agent.id;
    const workspaceId = agent.workspaceId;
    pills.get(agentId)?.remove();

    const isVisible = cachedSettings ? cachedSettings.enabled && cachedSettings.showComposerPill : true;

    pills.set(
      agentId,
      client.addComposerPill({
        id: "continuity-pill",
        workspaceId,
        agentId,
        button: {
          title: "Continue on next provider",
          icon: "ArrowRightLeft",
          label: "Continuity",
          visible: isVisible,
          behavior: {
            kind: "action",
            async onPress() {
              const result = await client.rpc(failoverNowRpc, { agentId });
              if (result.status !== "created") throw new Error(result.message);
              client.openPanel("chain", { workspaceId, agentId: result.newAgentId ?? agentId });
            },
          },
        },
      }),
    );
  };

  const removeAllPills = () => {
    for (const pill of pills.values()) pill.remove();
    pills.clear();
  };

  void client
    .rpc(getSettingsRpc, {})
    .then((settings) => {
      updatePillVisibility(settings);
    })
    .catch(() => {});

  void client.paseo.agents
    .list({ subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: ({ entries }) => {
          removeAllPills();
          for (const { agent } of entries) registerPill(agent);
        },
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") {
            registerPill(update.agent);
          } else if ("agentId" in update && typeof update.agentId === "string") {
            pills.get(update.agentId)?.remove();
            pills.delete(update.agentId);
          }
        },
      });
      return undefined;
    })
    .catch((error) => {
      if (!lifetime.signal.aborted) console.error("[continuity] agent observation failed", error);
    });

  return () => {
    lifetime.abort();
    removeAllPills();
  };
}
