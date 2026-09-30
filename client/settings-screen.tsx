import { type PluginSurfaceProps, useSettings } from "@getpaseo/plugin/client";
import {
  SettingsAction,
  SettingsCard,
  SettingsInput,
  SettingsSection,
  SettingsSelect,
  SettingsSwitch,
} from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import {
  type ContinuitySettings,
  continuitySettings,
} from "../shared/settings";
import { formatChain, parseChain } from "../shared/chain-format";

const COUNT_OPTIONS = ["1", "2", "3", "4", "5", "8"].map((value) => ({ label: value, value }));
const BUDGET_OPTIONS = ["20000", "40000", "60000", "100000", "150000", "200000"].map((value) => ({
  label: `${Number(value) / 1000}k chars`,
  value,
}));

export function SettingsScreen({ theme }: PluginSurfaceProps) {
  const settings = useSettings(continuitySettings);
  const [chainDraft, setChainDraft] = useState<string | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const muted = useMemo(() => ({ color: theme.colors.foregroundMuted, fontSize: 13 }), [theme]);

  if (settings.status === "loading") {
    return <Text style={muted}>Loading…</Text>;
  }
  if (settings.status !== "ready") {
    return (
      <SettingsSection title="Paseo Continuity">
        <SettingsCard>
          <SettingsAction
            label="Stored settings are unreadable"
            hint={settings.error}
            actionLabel="Reset to defaults"
            onPress={() => void settings.reset()}
          />
        </SettingsCard>
      </SettingsSection>
    );
  }

  const values = settings.values;
  const save = (next: ContinuitySettings) => void settings.save(next, settings.revision);

  return (
    <View style={{ gap: 16 }}>
      <SettingsSection title="Automatic failover">
        <SettingsCard>
          <SettingsSwitch
            label="Enable Paseo Continuity"
            hint="When a turn fails on quota or rate limits, continue in a new agent on the next provider."
            value={values.enabled}
            onValueChange={(enabled) => save({ ...values, enabled })}
          />
          <SettingsSwitch
            label="Usage quota exhausted"
            value={values.triggers.quota}
            onValueChange={(quota) => save({ ...values, triggers: { ...values.triggers, quota } })}
          />
          <SettingsSwitch
            label="Rate limited"
            value={values.triggers.rateLimit}
            onValueChange={(rateLimit) => save({ ...values, triggers: { ...values.triggers, rateLimit } })}
          />
          <SettingsSwitch
            label="Provider overloaded"
            hint="Usually transient; off by default."
            value={values.triggers.overloaded}
            onValueChange={(overloaded) => save({ ...values, triggers: { ...values.triggers, overloaded } })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Fallback chain">
        <SettingsCard>
          <SettingsInput
            label="Providers in order"
            hint="provider[/model][:mode], comma-separated. Example: codex:auto, claude:default, opencode/google/gemini-2.5-pro:build"
            error={chainError}
            initialValue={formatChain(values.chain)}
            onChangeText={(text) => {
              setChainDraft(text);
              setChainError(null);
            }}
          />
          <SettingsAction
            label="Save chain"
            actionLabel="Save"
            disabled={chainDraft === null}
            onPress={() => {
              if (chainDraft === null) return;
              const parsed = parseChain(chainDraft);
              if (typeof parsed === "string") {
                setChainError(parsed);
                return;
              }
              save({ ...values, chain: parsed });
              setChainDraft(null);
            }}
          />
          <SettingsSwitch
            label="Provider badge in new chat titles"
            value={values.titleBadges}
            onValueChange={(titleBadges) => save({ ...values, titleBadges })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Context transfer">
        <SettingsCard>
          <SettingsSelect
            label="Mode"
            hint="Automatic sends a bounded recent transcript; Full sends up to the full budget."
            value={values.contextMode}
            options={[
              { label: "Automatic", value: "automatic" },
              { label: "Full transcript", value: "full" },
            ]}
            onValueChange={(contextMode) => save({ ...values, contextMode })}
          />
          <SettingsSelect
            label="Automatic budget"
            value={String(values.budgets.automaticChars)}
            options={BUDGET_OPTIONS}
            onValueChange={(value) =>
              save({ ...values, budgets: { ...values.budgets, automaticChars: Number(value) } })
            }
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title="Loop protection">
        <SettingsCard>
          <SettingsSelect
            label="Maximum switches per chain"
            value={String(values.maxSwitchesPerChain)}
            options={COUNT_OPTIONS}
            onValueChange={(value) => save({ ...values, maxSwitchesPerChain: Number(value) })}
          />
          <SettingsSelect
            label="Maximum consecutive switches without progress"
            value={String(values.maxConsecutiveFailovers)}
            options={COUNT_OPTIONS}
            onValueChange={(value) => save({ ...values, maxConsecutiveFailovers: Number(value) })}
          />
        </SettingsCard>
      </SettingsSection>
      {settings.saveError ? <Text style={{ color: theme.colors.statusDanger }}>{settings.saveError}</Text> : null}
    </View>
  );
}
