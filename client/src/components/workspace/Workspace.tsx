import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import type { RulesetConfig, ParseRow, ParsedUrl, LintIssue, Patch } from "../../../../lib/core/types";
import { RulesetConfigSchema } from "../../../../lib/core/types";
import { detectInputMode } from "../../../../lib/core/detectInput";
import { parseTSVRange, detectLikelyUrlColumns } from "../../../../lib/core/parseTSV";
import { parseUrlRow } from "../../../../lib/core/parseUrl";
import { lintRow } from "../../../../lib/core/lint";
import { cleanFormatting } from "../../../../lib/core/clean";
import { diffRows } from "../../../../lib/core/diff";
import { reconstructUrl } from "../../../../lib/core/export";
import { BrutalButton, BrutalCard, BrutalCardHeader, BrutalCardContent, BrutalChip } from "../brutal";
import { RulesPanel } from "./RulesPanel";
import { RowReviewDrawer, patchKey } from "./RowReviewDrawer";
import { ExportBar } from "./ExportBar";
import { PaywallModal } from "./PaywallModal";
import { useAuth, saveDraftToLocal, loadDraftFromLocal } from "../../lib/auth";
import { Zap, AlertTriangle, CheckCircle, XCircle, Eye, AlertCircle } from "lucide-react";

interface WorkspaceProps {
  title?: string;
}

interface ProcessedData {
  rows: ParseRow[];
  rawUrls: string[];
  originalParsed: ParsedUrl[];
  cleanedUrls: ParsedUrl[];
  allIssues: LintIssue[];
  allPatches: Patch[];
  inputMode: "URL_LIST" | "TSV_RANGE";
  tsvUrlColumns?: number[];
  rowsCapped?: boolean;
  cappedAt?: number;
}

export function Workspace({ title = "UTM Spec" }: WorkspaceProps) {
  const [inputRaw, setInputRaw] = useState("");
  const [config, setConfig] = useState<RulesetConfig>(() => RulesetConfigSchema.parse({}));
  const [processed, setProcessed] = useState<ProcessedData | null>(null);
  const [selectedUrlCol, setSelectedUrlCol] = useState<number>(0);
  const [drawerRow, setDrawerRow] = useState<number | null>(null);
  const [approvedPatches, setApprovedPatches] = useState<Set<string>>(new Set());
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallFeature, setPaywallFeature] = useState("");
  const [, navigate] = useLocation();

  const { user, maxRows, tier, startCheckout } = useAuth();

  const detectedMode = useMemo(() => {
    if (!inputRaw.trim()) return null;
    return detectInputMode(inputRaw);
  }, [inputRaw]);

  const tsvPreview = useMemo(() => {
    if (detectedMode !== "TSV_RANGE") return null;
    const { rows } = parseTSVRange(inputRaw);
    const urlCols = detectLikelyUrlColumns(rows);
    return { rows, urlCols };
  }, [inputRaw, detectedMode]);

  function openPaywall(feature: string) {
    setPaywallFeature(feature);
    setPaywallOpen(true);
  }

  const handleParse = useCallback(() => {
    if (!inputRaw.trim()) return;

    const mode = detectInputMode(inputRaw);
    let rawUrls: string[];
    let tsvUrlColumns: number[] | undefined;

    if (mode === "TSV_RANGE") {
      const { rows: tsvRows } = parseTSVRange(inputRaw);
      const urlCols = detectLikelyUrlColumns(tsvRows);
      tsvUrlColumns = urlCols;
      const colIndex = urlCols.length > 0 ? selectedUrlCol : 0;
      rawUrls = tsvRows.map((row) => (row[colIndex] ?? "").trim()).filter((u) => u.length > 0);
    } else {
      rawUrls = inputRaw.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    }

    let rowsCapped = false;
    let cappedAt: number | undefined;
    if (maxRows !== Infinity && rawUrls.length > maxRows) {
      rowsCapped = true;
      cappedAt = maxRows;
      rawUrls = rawUrls.slice(0, maxRows);
    }

    const rows: ParseRow[] = [];
    const originalParsed: ParsedUrl[] = [];
    const cleanedUrls: ParsedUrl[] = [];
    const allIssues: LintIssue[] = [];
    const allPatches: Patch[] = [];

    for (let i = 0; i < rawUrls.length; i++) {
      const parsed = parseUrlRow(rawUrls[i]);
      const issues = lintRow(parsed, config, i);
      const cleaned = cleanFormatting(parsed, config);
      const patches = diffRows(parsed, cleaned, config, i);

      originalParsed.push(parsed);
      cleanedUrls.push(cleaned);
      allIssues.push(...issues);
      allPatches.push(...patches);

      rows.push({
        rowIndex: i,
        cells: [rawUrls[i]],
        url: cleaned,
        issues,
        patches,
      });
    }

    setProcessed({
      rows,
      rawUrls,
      originalParsed,
      cleanedUrls,
      allIssues,
      allPatches,
      inputMode: mode,
      tsvUrlColumns,
      rowsCapped,
      cappedAt,
    });
    setApprovedPatches(new Set());
    setDrawerRow(null);
  }, [inputRaw, config, selectedUrlCol, maxRows]);

  function toggleApproval(key: string) {
    setApprovedPatches((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const errorCount = processed ? processed.allIssues.filter((i) => i.severity === "Error").length : 0;
  const warnCount = processed ? processed.allIssues.filter((i) => i.severity === "Warning").length : 0;
  const safeCount = processed ? processed.allPatches.filter((p) => p.kind === "SAFE").length : 0;
  const semanticCount = processed ? processed.allPatches.filter((p) => p.kind === "SEMANTIC").length : 0;

  const drawerRowData = drawerRow !== null && processed ? processed.rows[drawerRow] : null;
  const drawerOriginalUrl = drawerRow !== null && processed ? processed.rawUrls[drawerRow] : "";

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b-3 border-ink bg-paper px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-black tracking-tight" data-testid="text-title">{title}</h1>
          {processed && (
            <div className="flex flex-wrap items-center gap-2">
              {errorCount > 0 && (
                <BrutalChip severity="error" data-testid="chip-error-count">
                  <XCircle className="h-3 w-3" /> {errorCount} error{errorCount !== 1 ? "s" : ""}
                </BrutalChip>
              )}
              {warnCount > 0 && (
                <BrutalChip severity="warn" data-testid="chip-warn-count">
                  <AlertTriangle className="h-3 w-3" /> {warnCount} warning{warnCount !== 1 ? "s" : ""}
                </BrutalChip>
              )}
              {safeCount > 0 && (
                <BrutalChip severity="ok" data-testid="chip-safe-count">
                  <CheckCircle className="h-3 w-3" /> {safeCount} safe fix{safeCount !== 1 ? "es" : ""}
                </BrutalChip>
              )}
              {semanticCount > 0 && (
                <BrutalChip severity="info" data-testid="chip-semantic-count">
                  <AlertTriangle className="h-3 w-3" /> {semanticCount} need{semanticCount !== 1 ? "" : "s"} approval
                </BrutalChip>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <RulesPanel
          config={config}
          onChange={setConfig}
          onPaywall={openPaywall}
        />

        <BrutalCard>
          <BrutalCardHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <span className="font-bold">Paste URLs</span>
              <div className="flex items-center gap-2 flex-wrap">
                {detectedMode && (
                  <BrutalChip severity="info" data-testid="chip-detected-mode">
                    {detectedMode === "TSV_RANGE" ? "TSV detected" : "URL list detected"}
                  </BrutalChip>
                )}
                {maxRows !== Infinity && (
                  <BrutalChip severity="warn" data-testid="chip-row-limit">
                    {tier === "guest" ? "Guest" : "Free"}: max {maxRows} rows
                  </BrutalChip>
                )}
              </div>
            </div>
          </BrutalCardHeader>
          <BrutalCardContent>
            <textarea
              value={inputRaw}
              onChange={(e) => setInputRaw(e.target.value)}
              placeholder={"Paste URLs here, one per line...\n\nhttps://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale"}
              className="brutal-input w-full font-mono text-xs resize-y"
              rows={6}
              data-testid="textarea-input"
            />

            {detectedMode === "TSV_RANGE" && tsvPreview && tsvPreview.urlCols.length > 1 && (
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold">URL Column:</span>
                {tsvPreview.urlCols.map((col) => (
                  <BrutalButton
                    key={col}
                    variant={selectedUrlCol === col ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setSelectedUrlCol(col)}
                    data-testid={`button-select-col-${col}`}
                  >
                    Column {col + 1}
                  </BrutalButton>
                ))}
              </div>
            )}

            <div className="mt-3">
              <BrutalButton
                onClick={handleParse}
                disabled={!inputRaw.trim()}
                data-testid="button-parse"
              >
                <Zap className="h-4 w-4" />
                Parse & Lint
              </BrutalButton>
            </div>
          </BrutalCardContent>
        </BrutalCard>

        {processed && processed.rowsCapped && (
          <div className="border-3 border-brutal-warn bg-brutal-warn/10 px-4 py-3 flex items-center justify-between gap-4 flex-wrap" data-testid="row-cap-warning">
            <p className="text-sm font-bold">
              Only the first {processed.cappedAt} rows were processed. Upgrade to Pro for unlimited rows.
            </p>
            <BrutalButton size="sm" onClick={() => openPaywall("Unlimited row processing")} data-testid="button-upgrade-rows">
              Upgrade
            </BrutalButton>
          </div>
        )}

        {processed && processed.rows.length > 0 && (
          <>
            <BrutalCard>
              <BrutalCardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <span className="font-bold">Results</span>
                  <ExportBar cleanedUrls={processed.cleanedUrls} onPaywall={openPaywall} />
                </div>
              </BrutalCardHeader>
              <BrutalCardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono" data-testid="table-results">
                    <thead>
                      <tr className="border-b-3 border-ink bg-ink/5">
                        <th className="border-r-3 border-ink px-3 py-2 text-left font-black w-10">#</th>
                        <th className="border-r-3 border-ink px-3 py-2 text-left font-black">Cleaned URL</th>
                        <th className="border-r-3 border-ink px-3 py-2 text-left font-black w-28">Status</th>
                        <th className="px-3 py-2 text-left font-black w-20">Review</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processed.rows.map((row, idx) => {
                        const hasErrors = row.issues.some((i) => i.severity === "Error");
                        const hasSemantic = row.patches.some((p) => p.kind === "SEMANTIC");
                        const hasSafe = row.patches.some((p) => p.kind === "SAFE");
                        const cleanedUrl = row.url ? reconstructUrl(row.url) : processed.rawUrls[idx];

                        let rowBg = "";
                        if (hasErrors) rowBg = "bg-brutal-alert/10";
                        else if (hasSemantic) rowBg = "bg-brutal-warn/10";
                        else if (hasSafe) rowBg = "bg-brutal-ok/10";

                        return (
                          <tr
                            key={idx}
                            className={`border-b-3 border-ink last:border-b-0 ${rowBg}`}
                            data-testid={`row-result-${idx}`}
                          >
                            <td className="border-r-3 border-ink px-3 py-2 font-black text-center">
                              {idx + 1}
                            </td>
                            <td className="border-r-3 border-ink px-3 py-2 break-all max-w-md">
                              <span data-testid={`text-cleaned-url-${idx}`}>{cleanedUrl}</span>
                            </td>
                            <td className="border-r-3 border-ink px-3 py-2">
                              <div className="flex flex-col gap-1">
                                {hasErrors && (
                                  <BrutalChip severity="error" data-testid={`chip-status-error-${idx}`}>
                                    Error
                                  </BrutalChip>
                                )}
                                {hasSemantic && (
                                  <BrutalChip severity="warn" data-testid={`chip-status-semantic-${idx}`}>
                                    Needs approval
                                  </BrutalChip>
                                )}
                                {hasSafe && !hasErrors && !hasSemantic && (
                                  <BrutalChip severity="ok" data-testid={`chip-status-safe-${idx}`}>
                                    Auto-fixed
                                  </BrutalChip>
                                )}
                                {!hasErrors && !hasSemantic && !hasSafe && (
                                  <BrutalChip severity="ok" data-testid={`chip-status-clean-${idx}`}>
                                    Clean
                                  </BrutalChip>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <BrutalButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setDrawerRow(idx)}
                                data-testid={`button-review-${idx}`}
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </BrutalButton>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </BrutalCardContent>
            </BrutalCard>
          </>
        )}
      </main>

      <RowReviewDrawer
        open={drawerRow !== null}
        onClose={() => setDrawerRow(null)}
        row={drawerRowData}
        originalUrl={drawerOriginalUrl}
        approvedPatches={approvedPatches}
        onToggleApproval={toggleApproval}
      />

      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        feature={paywallFeature}
        onUpgrade={() => {
          setPaywallOpen(false);
          startCheckout("pro_monthly");
        }}
        onLogin={!user ? () => navigate("/login") : undefined}
      />
    </div>
  );
}
