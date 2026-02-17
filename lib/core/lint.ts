import type { ParsedUrl, LintIssue, RulesetConfig } from "./types";

const UTM_LIKE_VARIANTS = [
  /^utmsource$/i,
  /^utmmedium$/i,
  /^utmcampaign$/i,
  /^utmcontent$/i,
  /^utmterm$/i,
  /^utm-source$/i,
  /^utm-medium$/i,
  /^utm-campaign$/i,
  /^utm-content$/i,
  /^utm-term$/i,
];

const ILLEGAL_CHARS_PATTERN = /[\s<>{}|\\^`[\]]/;

export function lintRow(
  parsed: ParsedUrl,
  ruleset: RulesetConfig,
  rowIndex: number = 0
): LintIssue[] {
  const issues: LintIssue[] = [];

  if (parsed.parseError) {
    issues.push({
      rowIndex,
      field: "url",
      severity: "Error",
      code: "MALFORMED_URL",
      message: parsed.parseError,
    });
    return issues;
  }

  for (const dupKey of parsed.duplicateKeys) {
    const values = parsed.utmParams
      .filter((p) => p.key === dupKey)
      .map((p) => p.value);
    const allSame = values.every((v) => v === values[0]);
    issues.push({
      rowIndex,
      field: dupKey,
      severity: allSame ? "Warning" : "Error",
      code: "DUPLICATE_UTM_KEY",
      message: allSame
        ? `Duplicate key "${dupKey}" with identical value "${values[0]}"`
        : `Conflicting duplicate key "${dupKey}" with values: ${values.map((v) => `"${v}"`).join(", ")}`,
    });
  }

  const missingSeverity = ruleset.missingRequiredSeverity === "warn" ? "Warning" : "Error";
  const presentUtmKeys = new Set(parsed.utmParams.map((p) => p.key));
  for (const required of ruleset.requiredParams) {
    if (!presentUtmKeys.has(required)) {
      issues.push({
        rowIndex,
        field: required,
        severity: missingSeverity,
        code: "MISSING_REQUIRED_PARAM",
        message: `Required parameter "${required}" is missing`,
      });
    }
  }

  for (const param of parsed.utmParams) {
    if (ruleset.requiredParams.includes(param.key) && param.value.trim() === "") {
      issues.push({
        rowIndex,
        field: param.key,
        severity: missingSeverity,
        code: "EMPTY_REQUIRED_VALUE",
        message: `Required parameter "${param.key}" has an empty value`,
      });
    }
  }

  if (ruleset.strictMode === "block" || ruleset.strictMode === "warn") {
    const severity = ruleset.strictMode === "block" ? "Error" : "Warning";

    if (ruleset.allowedSources.length > 0) {
      for (const param of parsed.utmParams) {
        if (param.key === "utm_source" && !ruleset.allowedSources.includes(param.value.toLowerCase())) {
          issues.push({
            rowIndex,
            field: "utm_source",
            severity,
            code: "STRICT_VALUE_VIOLATION",
            message: `Value "${param.value}" is not in the allowed sources list`,
          });
        }
      }
    }

    if (ruleset.allowedMediums.length > 0) {
      for (const param of parsed.utmParams) {
        if (param.key === "utm_medium" && !ruleset.allowedMediums.includes(param.value.toLowerCase())) {
          issues.push({
            rowIndex,
            field: "utm_medium",
            severity,
            code: "STRICT_VALUE_VIOLATION",
            message: `Value "${param.value}" is not in the allowed mediums list`,
          });
        }
      }
    }

    if (ruleset.allowedCampaigns && ruleset.allowedCampaigns.length > 0) {
      for (const param of parsed.utmParams) {
        if (param.key === "utm_campaign" && !ruleset.allowedCampaigns.includes(param.value.toLowerCase())) {
          issues.push({
            rowIndex,
            field: "utm_campaign",
            severity,
            code: "STRICT_VALUE_VIOLATION",
            message: `Value "${param.value}" is not in the allowed campaigns list`,
          });
        }
      }
    }
  }

  if (ruleset.caseRule !== "none") {
    for (const param of parsed.utmParams) {
      const val = param.value;
      if (!val) continue;
      const expected = ruleset.caseRule === "lower" ? val.toLowerCase() : val.toUpperCase();
      if (val !== expected) {
        issues.push({
          rowIndex,
          field: param.key,
          severity: "Warning",
          code: "CASING_DRIFT",
          message: `Value "${val}" does not match expected ${ruleset.caseRule}case: "${expected}"`,
        });
      }
    }
  }

  for (const param of parsed.utmParams) {
    if (ILLEGAL_CHARS_PATTERN.test(param.value)) {
      issues.push({
        rowIndex,
        field: param.key,
        severity: "Warning",
        code: "ILLEGAL_CHARS",
        message: `Value "${param.value}" contains spaces or illegal characters`,
      });
    }
  }

  for (const [rawKey] of Object.entries(parsed.otherParams)) {
    if (UTM_LIKE_VARIANTS.some((pattern) => pattern.test(rawKey))) {
      issues.push({
        rowIndex,
        field: rawKey,
        severity: "Warning",
        code: "UTM_LIKE_KEY",
        message: `Non-standard UTM-like key "${rawKey}" found — did you mean "utm_${rawKey.replace(/^utm[-_]?/i, "")}"?`,
      });
    }
  }

  if (ruleset.hostDomain && parsed.host) {
    const normalizedHost = parsed.host.toLowerCase().replace(/^www\./, "");
    const normalizedDomain = ruleset.hostDomain.toLowerCase().replace(/^www\./, "");
    if (normalizedHost === normalizedDomain) {
      issues.push({
        rowIndex,
        field: "host",
        severity: "Warning",
        code: "INTERNAL_LINK_UTM",
        message: `URL host "${parsed.host}" matches your own domain — UTM params on internal links will pollute analytics`,
      });
    }
  }

  return issues;
}
