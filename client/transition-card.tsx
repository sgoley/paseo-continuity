import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { useMemo } from "react";
import { Text, View } from "react-native";
import type { TransitionCard as CardData } from "../shared/contracts";
import { providerBadge } from "../shared/labels";

const REASON: Record<CardData["reason"], string> = {
  quota: "usage quota exhausted",
  rate_limit: "rate limited",
  overloaded: "provider overloaded",
  manual: "manual failover",
};

export function TransitionCard({ item, theme, layout }: PluginTimelineItemProps<CardData>) {
  const data = item.data;
  const from = providerBadge(data.fromProvider);
  const to = data.toProvider ? providerBadge(data.toProvider) : null;

  const tone =
    data.status === "created"
      ? theme.colors.statusSuccess
      : data.status === "creating"
        ? theme.colors.accent
        : data.status === "failed"
          ? theme.colors.statusDanger
          : theme.colors.statusWarning;

  const styles = useMemo(
    () => ({
      card: {
        marginVertical: 8,
        padding: layout.compact ? 10 : 12,
        gap: 4,
        borderRadius: 10,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderColor: theme.colors.border,
        borderLeftColor: tone,
        backgroundColor: theme.colors.surface1,
      },
      title: { color: theme.colors.foreground, fontSize: 14, fontWeight: "600" as const },
      body: { color: theme.colors.foreground, fontSize: 13 },
      muted: { color: theme.colors.foregroundMuted, fontSize: 12 },
    }),
    [theme, layout.compact, tone],
  );

  const headline = (() => {
    switch (data.status) {
      case "creating":
        return `Continuity: switching ${from.badge} ${from.label} → ${to ? `${to.badge} ${to.label}` : "fallback"}…`;
      case "created":
        return `Continued in ${data.toTitle ?? (to ? `${to.badge} ${to.label}` : "a new agent")}`;
      case "failed":
        return "Continuity: could not create the fallback agent";
      case "exhausted":
        return "Continuity: no fallback provider available";
      case "halted":
        return "Continuity: automatic switching stopped";
    }
  })();

  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.title}>{headline}</Text>
      <Text style={styles.body}>
        {`${from.badge} ${from.label} stopped: ${REASON[data.reason]}`}
      </Text>
      {data.evidence ? <Text style={styles.muted}>{`“${data.evidence}”`}</Text> : null}
      {data.toAgentId ? (
        <Text style={styles.muted}>
          {`New agent ${data.toAgentId.slice(0, 8)} is in this workspace's agent list. Open “Continuity chain” from ⌘K / Ctrl+K to jump to it.`}
        </Text>
      ) : null}
      {data.detail ? <Text style={styles.muted}>{data.detail}</Text> : null}
    </View>
  );
}
