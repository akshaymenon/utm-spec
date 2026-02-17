import type { ParsedUrl, Patch, RulesetConfig } from "./types";

export function diffRows(
  original: ParsedUrl,
  cleaned: ParsedUrl,
  ruleset: RulesetConfig,
  rowIndex: number = 0
): Patch[] {
  const patches: Patch[] = [];

  if (original.parseError || cleaned.parseError) {
    return patches;
  }

  const originalMap = new Map<string, string[]>();
  for (const p of original.utmParams) {
    const existing = originalMap.get(p.key) || [];
    existing.push(p.value);
    originalMap.set(p.key, existing);
  }

  const cleanedMap = new Map<string, string[]>();
  for (const p of cleaned.utmParams) {
    const existing = cleanedMap.get(p.key) || [];
    existing.push(p.value);
    cleanedMap.set(p.key, existing);
  }

  const allKeys = new Set([
    ...Array.from(originalMap.keys()),
    ...Array.from(cleanedMap.keys()),
  ]);

  for (const key of Array.from(allKeys)) {
    const origValues = originalMap.get(key) || [];
    const cleanValues = cleanedMap.get(key) || [];

    if (origValues.length === 0 && cleanValues.length > 0) {
      patches.push({
        rowIndex,
        field: key,
        kind: "SEMANTIC",
        before: "",
        after: cleanValues[0],
        description: `Parameter "${key}" was added`,
      });
      continue;
    }

    if (origValues.length > 0 && cleanValues.length === 0) {
      patches.push({
        rowIndex,
        field: key,
        kind: "SEMANTIC",
        before: origValues.join(", "),
        after: "",
        description: `Parameter "${key}" was removed`,
      });
      continue;
    }

    if (origValues.length !== cleanValues.length) {
      patches.push({
        rowIndex,
        field: key,
        kind: "ERROR",
        before: origValues.join(", "),
        after: cleanValues.join(", "),
        description: `Duplicate count changed for "${key}": ${origValues.length} → ${cleanValues.length}`,
      });
      continue;
    }

    const sortedOrig = [...origValues].sort();
    const sortedClean = [...cleanValues].sort();

    for (let i = 0; i < sortedOrig.length; i++) {
      const origVal = sortedOrig[i];
      const cleanVal = sortedClean[i];

      if (origVal !== cleanVal) {
        const kind = classifyChange(origVal, cleanVal);
        patches.push({
          rowIndex,
          field: key,
          kind,
          before: origVal,
          after: cleanVal,
          description: describeChange(kind, key, origVal, cleanVal),
        });
      }
    }
  }

  if (original.pathname !== cleaned.pathname) {
    const isSafe =
      original.pathname.replace(/\/+$/, "") === cleaned.pathname;
    patches.push({
      rowIndex,
      field: "pathname",
      kind: isSafe ? "SAFE" : "SEMANTIC",
      before: original.pathname,
      after: cleaned.pathname,
      description: isSafe
        ? "Removed trailing slash from pathname"
        : `Pathname changed from "${original.pathname}" to "${cleaned.pathname}"`,
    });
  }

  if (original.fragment !== cleaned.fragment) {
    patches.push({
      rowIndex,
      field: "fragment",
      kind: ruleset.stripFragment ? "SAFE" : "SEMANTIC",
      before: original.fragment,
      after: cleaned.fragment,
      description: original.fragment && !cleaned.fragment
        ? "Fragment stripped"
        : `Fragment changed from "${original.fragment}" to "${cleaned.fragment}"`,
    });
  }

  const origOrder = original.utmParams.map((p) => p.key).join(",");
  const cleanOrder = cleaned.utmParams.map((p) => p.key).join(",");
  const origOrderSet = new Set(original.utmParams.map((p) => p.key));
  const cleanOrderSet = new Set(cleaned.utmParams.map((p) => p.key));
  const sameKeys =
    origOrderSet.size === cleanOrderSet.size &&
    Array.from(origOrderSet).every((k) => cleanOrderSet.has(k));

  if (origOrder !== cleanOrder && sameKeys) {
    patches.push({
      rowIndex,
      field: "param_order",
      kind: "SAFE",
      before: origOrder,
      after: cleanOrder,
      description: "Parameters reordered to canonical order",
    });
  }

  return patches;
}

function classifyChange(
  before: string,
  after: string
): "SAFE" | "SEMANTIC" | "ERROR" {
  if (before.toLowerCase() === after.toLowerCase()) {
    return "SAFE";
  }

  if (before.trim() !== before && after === before.trim()) {
    return "SAFE";
  }

  const normalized = before.trim().replace(/\s+/g, "_");
  if (normalized === after || normalized.toLowerCase() === after.toLowerCase()) {
    return "SAFE";
  }

  return "SEMANTIC";
}

function describeChange(
  kind: "SAFE" | "SEMANTIC" | "ERROR",
  key: string,
  before: string,
  after: string
): string {
  if (kind === "SAFE") {
    if (before.toLowerCase() === after.toLowerCase()) {
      return `Case normalized for "${key}": "${before}" → "${after}"`;
    }
    if (before.trim() !== before) {
      return `Trimmed whitespace for "${key}": "${before}" → "${after}"`;
    }
    if (before.includes(" ")) {
      return `Spaces replaced with underscores for "${key}": "${before}" → "${after}"`;
    }
    return `Safe formatting change for "${key}": "${before}" → "${after}"`;
  }

  if (kind === "ERROR") {
    return `Error: conflicting change for "${key}": "${before}" → "${after}"`;
  }

  return `Value changed for "${key}": "${before}" → "${after}"`;
}
