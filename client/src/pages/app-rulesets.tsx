import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../lib/auth";
import { BrutalButton, BrutalCard, BrutalCardHeader, BrutalCardContent, BrutalChip } from "../components/brutal";
import { PaywallModal } from "../components/workspace/PaywallModal";
import { RulesetConfigSchema } from "../../../lib/core/types";
import type { RulesetConfig } from "../../../lib/core/types";
import type { Ruleset } from "../../../shared/schema";
import { ArrowLeft, Plus, Pencil, Trash2, Check, X, Settings } from "lucide-react";

export default function AppRulesetsPage() {
  const { user, loading, configured, tier, maxRulesets, startCheckout } = useAuth();
  const [, navigate] = useLocation();
  const [rulesets, setRulesets] = useState<Ruleset[]>([]);
  const [loadingRulesets, setLoadingRulesets] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [paywallOpen, setPaywallOpen] = useState(false);

  useEffect(() => {
    if (!loading && configured && !user) {
      navigate("/login");
    }
  }, [loading, user, configured, navigate]);

  useEffect(() => {
    if (user) fetchRulesets();
  }, [user]);

  async function fetchRulesets() {
    if (!user) return;
    setLoadingRulesets(true);
    try {
      const res = await fetch(`/api/rulesets/${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setRulesets(data);
      }
    } catch (err) {
      console.error("Failed to fetch rulesets:", err);
    } finally {
      setLoadingRulesets(false);
    }
  }

  async function handleCreate() {
    if (!user || !newName.trim()) return;

    if (rulesets.length >= maxRulesets) {
      setPaywallOpen(true);
      return;
    }

    try {
      const defaultConfig = RulesetConfigSchema.parse({ name: newName.trim() });
      const res = await fetch("/api/rulesets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          name: newName.trim(),
          configJson: JSON.stringify(defaultConfig),
        }),
      });

      if (res.status === 403) {
        setPaywallOpen(true);
        return;
      }

      if (res.ok) {
        setCreating(false);
        setNewName("");
        await fetchRulesets();
      }
    } catch (err) {
      console.error("Failed to create ruleset:", err);
    }
  }

  async function handleRename(id: number) {
    if (!user || !editName.trim()) return;

    try {
      const res = await fetch(`/api/rulesets/${id}?userId=${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (res.ok) {
        setEditingId(null);
        setEditName("");
        await fetchRulesets();
      }
    } catch (err) {
      console.error("Failed to rename ruleset:", err);
    }
  }

  async function handleDelete(id: number) {
    if (!user) return;

    try {
      const res = await fetch(`/api/rulesets/${id}?userId=${user.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await fetchRulesets();
      }
    } catch (err) {
      console.error("Failed to delete ruleset:", err);
    }
  }

  function parseConfig(json: string): RulesetConfig | null {
    try {
      return RulesetConfigSchema.parse(JSON.parse(json));
    } catch {
      return null;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <p className="font-bold text-lg">Loading...</p>
      </div>
    );
  }

  if (configured && !user) return null;

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-3 border-ink bg-paper px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <BrutalButton variant="ghost" size="sm" onClick={() => navigate("/app/run")} data-testid="button-back-to-workspace">
              <ArrowLeft className="h-4 w-4" />
            </BrutalButton>
            <h1 className="text-2xl font-black tracking-tight" data-testid="text-rulesets-title">
              Saved Rulesets
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <BrutalChip severity="info">
              {rulesets.length}/{maxRulesets === Infinity ? "unlimited" : maxRulesets}
            </BrutalChip>
            <BrutalChip severity={tier === "pro" ? "ok" : "warn"}>
              {tier === "pro" ? "Pro" : "Free"}
            </BrutalChip>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6 space-y-4">
        {creating ? (
          <BrutalCard>
            <BrutalCardContent>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  placeholder="Ruleset name..."
                  className="brutal-input flex-1"
                  autoFocus
                  data-testid="input-new-ruleset-name"
                />
                <BrutalButton size="sm" onClick={handleCreate} disabled={!newName.trim()} data-testid="button-confirm-create">
                  <Check className="h-3 w-3" />
                  Create
                </BrutalButton>
                <BrutalButton variant="ghost" size="sm" onClick={() => { setCreating(false); setNewName(""); }} data-testid="button-cancel-create">
                  <X className="h-3 w-3" />
                </BrutalButton>
              </div>
            </BrutalCardContent>
          </BrutalCard>
        ) : (
          <BrutalButton
            variant="secondary"
            onClick={() => {
              if (rulesets.length >= maxRulesets) {
                setPaywallOpen(true);
              } else {
                setCreating(true);
              }
            }}
            data-testid="button-new-ruleset"
          >
            <Plus className="h-4 w-4" />
            New Ruleset
          </BrutalButton>
        )}

        {loadingRulesets ? (
          <p className="text-sm text-muted-foreground">Loading rulesets...</p>
        ) : rulesets.length === 0 ? (
          <BrutalCard>
            <BrutalCardContent>
              <div className="text-center py-8 space-y-2">
                <Settings className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="font-bold">No saved rulesets</p>
                <p className="text-sm text-muted-foreground">
                  Create rulesets to reuse your UTM validation rules across sessions.
                </p>
              </div>
            </BrutalCardContent>
          </BrutalCard>
        ) : (
          rulesets.map((rs) => {
            const config = parseConfig(rs.configJson);
            const isEditing = editingId === rs.id;

            return (
              <BrutalCard key={rs.id} data-testid={`card-ruleset-${rs.id}`}>
                <BrutalCardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 flex-wrap">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(rs.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="brutal-input flex-1"
                          autoFocus
                          data-testid={`input-rename-${rs.id}`}
                        />
                        <BrutalButton size="sm" onClick={() => handleRename(rs.id)} data-testid={`button-confirm-rename-${rs.id}`}>
                          <Check className="h-3 w-3" />
                        </BrutalButton>
                        <BrutalButton variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </BrutalButton>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold" data-testid={`text-ruleset-name-${rs.id}`}>{rs.name}</span>
                        <div className="flex items-center gap-1">
                          <BrutalButton
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingId(rs.id); setEditName(rs.name); }}
                            data-testid={`button-rename-${rs.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </BrutalButton>
                          <BrutalButton
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rs.id)}
                            data-testid={`button-delete-${rs.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </BrutalButton>
                        </div>
                      </>
                    )}
                  </div>
                </BrutalCardHeader>
                {config && (
                  <BrutalCardContent>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <BrutalChip severity="info">Case: {config.caseRule}</BrutalChip>
                      <BrutalChip severity="info">Strict: {config.strictMode}</BrutalChip>
                      {config.hostDomain && <BrutalChip severity="info">Domain: {config.hostDomain}</BrutalChip>}
                      {(config.allowedSources?.length ?? 0) > 0 && (
                        <BrutalChip severity="info">{config.allowedSources!.length} sources</BrutalChip>
                      )}
                      {(config.allowedMediums?.length ?? 0) > 0 && (
                        <BrutalChip severity="info">{config.allowedMediums!.length} mediums</BrutalChip>
                      )}
                    </div>
                  </BrutalCardContent>
                )}
              </BrutalCard>
            );
          })
        )}
      </main>

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature="Saving more rulesets"
        onUpgrade={() => {
          setPaywallOpen(false);
          startCheckout("pro_monthly");
        }}
      />
    </div>
  );
}
