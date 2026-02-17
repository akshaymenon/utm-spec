import { useState } from "react";
import { useLocation } from "wouter";
import type { RulesetConfig } from "../../../../lib/core/types";
import { BrutalCard, BrutalCardHeader, BrutalCardContent, BrutalButton, BrutalChip } from "../brutal";
import { Settings, ChevronDown, ChevronUp, X, Save } from "lucide-react";
import { useAuth } from "../../lib/auth";

interface RulesPanelProps {
  config: RulesetConfig;
  onChange: (config: RulesetConfig) => void;
  onPaywall?: (feature: string) => void;
}

export function RulesPanel({ config, onChange, onPaywall }: RulesPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [newSource, setNewSource] = useState("");
  const [newMedium, setNewMedium] = useState("");
  const [newCampaign, setNewCampaign] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error" | "limit">("idle");
  const { user, maxRulesets, tier } = useAuth();
  const [, navigate] = useLocation();

  function update(partial: Partial<RulesetConfig>) {
    onChange({ ...config, ...partial });
  }

  function addToList(field: "allowedSources" | "allowedMediums" | "allowedCampaigns", value: string, setter: (v: string) => void) {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return;
    const current = config[field] ?? [];
    if (!current.includes(trimmed)) {
      update({ [field]: [...current, trimmed] });
    }
    setter("");
  }

  function removeFromList(field: "allowedSources" | "allowedMediums" | "allowedCampaigns", value: string) {
    const current = config[field] ?? [];
    update({ [field]: current.filter((v) => v !== value) });
  }

  async function handleSave() {
    if (!user) {
      navigate("/login");
      return;
    }

    if (tier === "guest") {
      navigate("/login");
      return;
    }

    setSaving(true);
    setSaveStatus("idle");

    try {
      const res = await fetch("/api/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: config.name || "Untitled Ruleset",
          configJson: JSON.stringify(config),
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.code === "RULESET_LIMIT") {
          setSaveStatus("limit");
          onPaywall?.("Saving more rulesets");
          return;
        }
      }

      if (!res.ok) {
        setSaveStatus("error");
        return;
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BrutalCard>
      <BrutalCardHeader>
        <button
          className="flex w-full items-center justify-between gap-2"
          onClick={() => setExpanded(!expanded)}
          data-testid="button-toggle-rules"
        >
          <span className="flex items-center gap-2 font-bold">
            <Settings className="h-4 w-4" />
            Ruleset Config
          </span>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </BrutalCardHeader>

      {expanded && (
        <BrutalCardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm font-bold">
                Name
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Ruleset name"
                  className="brutal-input"
                  data-testid="input-ruleset-name"
                />
              </label>

              <label className="flex items-center gap-2 text-sm font-bold" data-testid="label-case-rule">
                Case Rule
                <select
                  value={config.caseRule}
                  onChange={(e) => update({ caseRule: e.target.value as "lower" | "upper" | "none" })}
                  className="brutal-input"
                  data-testid="select-case-rule"
                >
                  <option value="lower">lowercase</option>
                  <option value="upper">UPPERCASE</option>
                  <option value="none">No change</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold" data-testid="label-strict-mode">
                Strict Mode
                <select
                  value={config.strictMode}
                  onChange={(e) => update({ strictMode: e.target.value as "off" | "warn" | "block" })}
                  className="brutal-input"
                  data-testid="select-strict-mode"
                >
                  <option value="off">Off</option>
                  <option value="warn">Warn</option>
                  <option value="block">Block</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold" data-testid="label-missing-severity">
                Missing Required
                <select
                  value={config.missingRequiredSeverity ?? "error"}
                  onChange={(e) => update({ missingRequiredSeverity: e.target.value as "error" | "warn" })}
                  className="brutal-input"
                  data-testid="select-missing-severity"
                >
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={config.stripFragment}
                  onChange={(e) => update({ stripFragment: e.target.checked })}
                  className="h-4 w-4 border-3 border-ink accent-brutal-accent"
                  data-testid="checkbox-strip-fragment"
                />
                Strip Fragment
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold mb-1">Host Domain (internal link warning)</label>
              <input
                type="text"
                value={config.hostDomain ?? ""}
                onChange={(e) => update({ hostDomain: e.target.value || undefined })}
                placeholder="example.com"
                className="brutal-input w-full max-w-xs"
                data-testid="input-host-domain"
              />
            </div>

            <ListEditor
              label="Allowed Sources"
              items={config.allowedSources ?? []}
              inputValue={newSource}
              onInputChange={setNewSource}
              onAdd={() => addToList("allowedSources", newSource, setNewSource)}
              onRemove={(v) => removeFromList("allowedSources", v)}
              testIdPrefix="sources"
            />

            <ListEditor
              label="Allowed Mediums"
              items={config.allowedMediums ?? []}
              inputValue={newMedium}
              onInputChange={setNewMedium}
              onAdd={() => addToList("allowedMediums", newMedium, setNewMedium)}
              onRemove={(v) => removeFromList("allowedMediums", v)}
              testIdPrefix="mediums"
            />

            <ListEditor
              label="Allowed Campaigns"
              items={config.allowedCampaigns ?? []}
              inputValue={newCampaign}
              onInputChange={setNewCampaign}
              onAdd={() => addToList("allowedCampaigns", newCampaign, setNewCampaign)}
              onRemove={(v) => removeFromList("allowedCampaigns", v)}
              testIdPrefix="campaigns"
            />

            <div className="flex items-center gap-3 pt-2 border-t-3 border-ink/10 flex-wrap">
              <BrutalButton
                variant="secondary"
                size="sm"
                onClick={handleSave}
                disabled={saving}
                data-testid="button-save-ruleset"
              >
                <Save className="h-3 w-3" />
                {saving ? "Saving..." : "Save Ruleset"}
              </BrutalButton>

              {saveStatus === "saved" && (
                <BrutalChip severity="ok">Saved</BrutalChip>
              )}
              {saveStatus === "error" && (
                <BrutalChip severity="error">Save failed</BrutalChip>
              )}
              {saveStatus === "limit" && (
                <BrutalChip severity="warn">Limit reached — upgrade to Pro</BrutalChip>
              )}

              {tier !== "guest" && maxRulesets !== Infinity && (
                <span className="text-xs text-muted-foreground">
                  Max {maxRulesets} rulesets on {tier} plan
                </span>
              )}
            </div>
          </div>
        </BrutalCardContent>
      )}
    </BrutalCard>
  );
}

function ListEditor({
  label,
  items,
  inputValue,
  onInputChange,
  onAdd,
  onRemove,
  testIdPrefix,
}: {
  label: string;
  items: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  testIdPrefix: string;
}) {
  return (
    <div>
      <label className="block text-sm font-bold mb-1">{label}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={`Add ${label.toLowerCase()}...`}
          className="brutal-input flex-1 min-w-[140px]"
          data-testid={`input-${testIdPrefix}`}
        />
        <BrutalButton variant="secondary" size="sm" onClick={onAdd} data-testid={`button-add-${testIdPrefix}`}>
          Add
        </BrutalButton>
      </div>
      {items.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {items.map((item) => (
            <BrutalChip key={item} severity="info" data-testid={`chip-${testIdPrefix}-${item}`}>
              {item}
              <button
                onClick={() => onRemove(item)}
                className="ml-1 inline-flex"
                data-testid={`button-remove-${testIdPrefix}-${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </BrutalChip>
          ))}
        </div>
      )}
    </div>
  );
}
