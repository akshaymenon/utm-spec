import type { DraftPayload, ParsedUrl, LintIssue, Patch, ParseRow } from "./types";
import { detectInputMode } from "./detectInput";
import { parseTSVRange, detectLikelyUrlColumns } from "./parseTSV";
import { parseUrlRow } from "./parseUrl";
import { lintRow } from "./lint";
import { cleanFormatting } from "./clean";
import { diffRows } from "./diff";

export interface RehydrateResult {
  rows: ParseRow[];
  allIssues: LintIssue[];
  allPatches: Patch[];
  cleanedUrls: ParsedUrl[];
}

export function rehydrateFromDraft(payload: DraftPayload): RehydrateResult {
  const { inputRaw, rulesetConfig } = payload;
  const mode = detectInputMode(inputRaw);

  let rawUrls: string[];

  if (mode === "TSV_RANGE") {
    const { rows: tsvRows } = parseTSVRange(inputRaw);
    const urlCols = detectLikelyUrlColumns(tsvRows);
    const urlColIndex = urlCols.length > 0 ? urlCols[0] : 0;
    rawUrls = tsvRows.map((row) => (row[urlColIndex] ?? "").trim()).filter((u) => u.length > 0);
  } else {
    rawUrls = inputRaw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  const rows: ParseRow[] = [];
  const allIssues: LintIssue[] = [];
  const allPatches: Patch[] = [];
  const cleanedUrls: ParsedUrl[] = [];

  for (let i = 0; i < rawUrls.length; i++) {
    const parsed = parseUrlRow(rawUrls[i]);
    const issues = lintRow(parsed, rulesetConfig, i);
    const cleaned = cleanFormatting(parsed, rulesetConfig);
    const patches = diffRows(parsed, cleaned, rulesetConfig, i);

    rows.push({
      rowIndex: i,
      cells: [rawUrls[i]],
      url: cleaned,
      issues,
      patches,
    });

    allIssues.push(...issues);
    allPatches.push(...patches);
    cleanedUrls.push(cleaned);
  }

  return { rows, allIssues, allPatches, cleanedUrls };
}
