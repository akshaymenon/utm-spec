import { describe, it, expect } from "vitest";
import { parseUrlRow } from "../parseUrl";
import { lintRow } from "../lint";
import type { RulesetConfig } from "../types";

const defaultRuleset: RulesetConfig = {
  name: "Default",
  requiredParams: ["utm_source", "utm_medium", "utm_campaign"],
  missingRequiredSeverity: "error",
  allowedSources: [],
  allowedMediums: [],
  allowedCampaigns: [],
  caseRule: "lower",
  trimWhitespace: true,
  stripFragment: false,
  strictMode: "off",
};

describe("parseUrlRow", () => {
  it("extracts utm params from a valid URL", () => {
    const result = parseUrlRow(
      "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale"
    );
    expect(result.parseError).toBeUndefined();
    expect(result.protocol).toBe("https");
    expect(result.host).toBe("example.com");
    expect(result.pathname).toBe("/page");
    expect(result.utmParams).toHaveLength(3);
    expect(result.utmParams[0]).toEqual({
      key: "utm_source",
      value: "google",
      rawKey: "utm_source",
    });
    expect(result.utmParams[1]).toEqual({
      key: "utm_medium",
      value: "cpc",
      rawKey: "utm_medium",
    });
    expect(result.duplicateKeys).toEqual([]);
  });

  it("detects duplicate UTM keys and retains all values", () => {
    const result = parseUrlRow(
      "https://example.com?utm_source=google&utm_source=facebook&utm_medium=cpc"
    );
    expect(result.utmParams).toHaveLength(3);
    expect(result.utmParams.filter((p) => p.key === "utm_source")).toHaveLength(2);
    expect(result.duplicateKeys).toContain("utm_source");
  });

  it("returns parseError for malformed URL", () => {
    const result = parseUrlRow("not-a-url");
    expect(result.parseError).toBeDefined();
    expect(result.protocol).toBe("");
    expect(result.host).toBe("");
  });

  it("handles empty string", () => {
    const result = parseUrlRow("");
    expect(result.parseError).toBe("Empty URL");
  });

  it("separates UTM params from other params", () => {
    const result = parseUrlRow(
      "https://example.com?utm_source=test&ref=homepage&fbclid=abc123"
    );
    expect(result.utmParams).toHaveLength(1);
    expect(result.otherParams["ref"]).toBe("homepage");
    expect(result.otherParams["fbclid"]).toBe("abc123");
  });

  it("extracts fragment", () => {
    const result = parseUrlRow(
      "https://example.com?utm_source=google#section-2"
    );
    expect(result.fragment).toBe("section-2");
  });

  it("handles URL with mixed case UTM keys", () => {
    const result = parseUrlRow(
      "https://example.com?UTM_SOURCE=Google&utm_medium=CPC"
    );
    expect(result.utmParams[0].rawKey).toBe("UTM_SOURCE");
    expect(result.utmParams[0].key).toBe("utm_source");
    expect(result.utmParams[0].value).toBe("Google");
  });
});

describe("lintRow", () => {
  it("returns no errors for a fully valid URL", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const errors = issues.filter((i) => i.severity === "Error");
    expect(errors).toHaveLength(0);
  });

  it("reports missing utm_campaign as error", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const missing = issues.find((i) => i.code === "MISSING_REQUIRED_PARAM" && i.field === "utm_campaign");
    expect(missing).toBeDefined();
    expect(missing!.severity).toBe("Error");
  });

  it("reports conflicting duplicate utm_source as error", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_source=facebook&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const dup = issues.find((i) => i.code === "DUPLICATE_UTM_KEY");
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe("Error");
    expect(dup!.message).toContain("Conflicting");
  });

  it("reports identical duplicate as warning instead of error", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const dup = issues.find((i) => i.code === "DUPLICATE_UTM_KEY");
    expect(dup).toBeDefined();
    expect(dup!.severity).toBe("Warning");
  });

  it("reports malformed URL error", () => {
    const parsed = parseUrlRow("not-a-url");
    const issues = lintRow(parsed, defaultRuleset);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("MALFORMED_URL");
    expect(issues[0].severity).toBe("Error");
  });

  it("reports casing drift as warning", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=Google&utm_medium=CPC&utm_campaign=Spring_Sale"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const casingIssues = issues.filter((i) => i.code === "CASING_DRIFT");
    expect(casingIssues.length).toBeGreaterThanOrEqual(3);
    expect(casingIssues[0].severity).toBe("Warning");
  });

  it("warns about internal-link UTM when hostDomain matches", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      hostDomain: "example.com",
    };
    const parsed = parseUrlRow(
      "https://www.example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, ruleset);
    const internal = issues.find((i) => i.code === "INTERNAL_LINK_UTM");
    expect(internal).toBeDefined();
    expect(internal!.severity).toBe("Warning");
  });

  it("reports strict allowed values violation in block mode", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "block",
      allowedSources: ["google", "facebook"],
    };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=tiktok&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, ruleset);
    const strict = issues.find((i) => i.code === "STRICT_VALUE_VIOLATION");
    expect(strict).toBeDefined();
    expect(strict!.severity).toBe("Error");
    expect(strict!.message).toContain("tiktok");
  });

  it("reports strict violation as warning in warn mode", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "warn",
      allowedMediums: ["cpc", "email"],
    };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=social&utm_campaign=test"
    );
    const issues = lintRow(parsed, ruleset);
    const strict = issues.find((i) => i.code === "STRICT_VALUE_VIOLATION");
    expect(strict).toBeDefined();
    expect(strict!.severity).toBe("Warning");
  });

  it("warns about UTM-like non-standard keys", () => {
    const parsed = parseUrlRow(
      "https://example.com?utmSource=google&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const utmLike = issues.find((i) => i.code === "UTM_LIKE_KEY");
    expect(utmLike).toBeDefined();
    expect(utmLike!.severity).toBe("Warning");
  });

  it("reports empty required value as error", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const empty = issues.find((i) => i.code === "EMPTY_REQUIRED_VALUE");
    expect(empty).toBeDefined();
    expect(empty!.severity).toBe("Error");
    expect(empty!.field).toBe("utm_source");
  });

  it("warns about illegal characters in values", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=goo gle&utm_medium=cpc&utm_campaign=test"
    );
    const issues = lintRow(parsed, defaultRuleset);
    const illegal = issues.find((i) => i.code === "ILLEGAL_CHARS");
    expect(illegal).toBeDefined();
    expect(illegal!.severity).toBe("Warning");
  });

  it("respects missingRequiredSeverity=warn to downgrade missing params to Warning", () => {
    const warnRuleset: RulesetConfig = {
      ...defaultRuleset,
      missingRequiredSeverity: "warn",
    };
    const parsed = parseUrlRow("https://example.com?utm_source=google");
    const issues = lintRow(parsed, warnRuleset);
    const missing = issues.filter((i) => i.code === "MISSING_REQUIRED_PARAM");
    expect(missing.length).toBe(2);
    expect(missing.every((i) => i.severity === "Warning")).toBe(true);
  });

  it("respects missingRequiredSeverity=warn for empty required values", () => {
    const warnRuleset: RulesetConfig = {
      ...defaultRuleset,
      missingRequiredSeverity: "warn",
    };
    const parsed = parseUrlRow("https://example.com?utm_source=&utm_medium=cpc&utm_campaign=test");
    const issues = lintRow(parsed, warnRuleset);
    const empty = issues.find((i) => i.code === "EMPTY_REQUIRED_VALUE");
    expect(empty).toBeDefined();
    expect(empty!.severity).toBe("Warning");
  });
});
