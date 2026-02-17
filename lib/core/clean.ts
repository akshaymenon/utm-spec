import type { ParsedUrl, Patch, RulesetConfig } from "./types";

const CANONICAL_UTM_ORDER = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function cleanFormatting(
  parsed: ParsedUrl,
  ruleset: RulesetConfig
): ParsedUrl {
  if (parsed.parseError) {
    return parsed;
  }

  let utmParams = parsed.utmParams.map((p) => ({ ...p }));

  if (ruleset.trimWhitespace) {
    utmParams = utmParams.map((p) => ({
      ...p,
      key: p.key.trim(),
      value: p.value.trim(),
    }));
  }

  utmParams = utmParams.map((p) => ({
    ...p,
    value: p.value.replace(/\s+/g, "_"),
  }));

  if (ruleset.caseRule === "lower") {
    utmParams = utmParams.map((p) => ({
      ...p,
      key: p.key.toLowerCase(),
      value: p.value.toLowerCase(),
    }));
  } else if (ruleset.caseRule === "upper") {
    utmParams = utmParams.map((p) => ({
      ...p,
      key: p.key.toLowerCase(),
      value: p.value.toUpperCase(),
    }));
  } else {
    utmParams = utmParams.map((p) => ({
      ...p,
      key: p.key.toLowerCase(),
    }));
  }

  utmParams.sort((a, b) => {
    const ai = CANONICAL_UTM_ORDER.indexOf(a.key);
    const bi = CANONICAL_UTM_ORDER.indexOf(b.key);
    const aOrder = ai === -1 ? CANONICAL_UTM_ORDER.length : ai;
    const bOrder = bi === -1 ? CANONICAL_UTM_ORDER.length : bi;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.key.localeCompare(b.key);
  });

  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "");
  }

  const fragment = ruleset.stripFragment ? "" : parsed.fragment;

  return {
    ...parsed,
    pathname,
    utmParams,
    fragment,
    duplicateKeys: parsed.duplicateKeys,
  };
}

export function suggestSemanticFixes(
  parsed: ParsedUrl,
  ruleset: RulesetConfig,
  rowIndex: number = 0
): Patch[] {
  const patches: Patch[] = [];

  if (parsed.parseError) {
    return patches;
  }

  if (ruleset.allowedSources.length > 0) {
    for (const param of parsed.utmParams) {
      if (param.key === "utm_source") {
        const match = findClosestMatch(param.value, ruleset.allowedSources);
        if (match && match.toLowerCase() !== param.value.toLowerCase()) {
          patches.push({
            rowIndex,
            field: "utm_source",
            kind: "SEMANTIC",
            before: param.value,
            after: match,
            description: `Suggest changing utm_source from "${param.value}" to allowed value "${match}"`,
          });
        }
      }
    }
  }

  if (ruleset.allowedMediums.length > 0) {
    for (const param of parsed.utmParams) {
      if (param.key === "utm_medium") {
        const match = findClosestMatch(param.value, ruleset.allowedMediums);
        if (match && match.toLowerCase() !== param.value.toLowerCase()) {
          patches.push({
            rowIndex,
            field: "utm_medium",
            kind: "SEMANTIC",
            before: param.value,
            after: match,
            description: `Suggest changing utm_medium from "${param.value}" to allowed value "${match}"`,
          });
        }
      }
    }
  }

  if (ruleset.allowedCampaigns && ruleset.allowedCampaigns.length > 0) {
    for (const param of parsed.utmParams) {
      if (param.key === "utm_campaign") {
        const match = findClosestMatch(param.value, ruleset.allowedCampaigns);
        if (match && match.toLowerCase() !== param.value.toLowerCase()) {
          patches.push({
            rowIndex,
            field: "utm_campaign",
            kind: "SEMANTIC",
            before: param.value,
            after: match,
            description: `Suggest changing utm_campaign from "${param.value}" to allowed value "${match}"`,
          });
        }
      }
    }
  }

  return patches;
}

function findClosestMatch(
  value: string,
  allowed: string[]
): string | null {
  const lower = value.toLowerCase();
  const exact = allowed.find((a) => a.toLowerCase() === lower);
  if (exact) return null;

  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const candidate of allowed) {
    const dist = levenshtein(lower, candidate.toLowerCase());
    if (dist < bestDistance && dist <= Math.max(2, Math.floor(lower.length / 3))) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = [];

  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}
