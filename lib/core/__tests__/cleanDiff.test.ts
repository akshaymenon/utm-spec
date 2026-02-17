import { describe, it, expect } from "vitest";
import { cleanFormatting, suggestSemanticFixes } from "../clean";
import { diffRows } from "../diff";
import { toUrlList, toTSV, toCSV, reconstructUrl } from "../export";
import { parseUrlRow } from "../parseUrl";
import type { RulesetConfig, ParsedUrl } from "../types";

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

describe("cleanFormatting", () => {
  it("is idempotent — applying twice gives the same result", () => {
    const parsed = parseUrlRow(
      "https://example.com/page/?UTM_SOURCE=Google&utm_medium=CPC&utm_campaign=Spring Sale"
    );
    const once = cleanFormatting(parsed, defaultRuleset);
    const twice = cleanFormatting(once, defaultRuleset);
    expect(twice).toEqual(once);
  });

  it("lowercases UTM values when caseRule is lower", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=Google&utm_medium=CPC&utm_campaign=test"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.utmParams.find((p) => p.key === "utm_source")!.value).toBe("google");
    expect(cleaned.utmParams.find((p) => p.key === "utm_medium")!.value).toBe("cpc");
  });

  it("uppercases UTM values when caseRule is upper", () => {
    const ruleset: RulesetConfig = { ...defaultRuleset, caseRule: "upper" };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const cleaned = cleanFormatting(parsed, ruleset);
    expect(cleaned.utmParams.find((p) => p.key === "utm_source")!.value).toBe("GOOGLE");
    expect(cleaned.utmParams.find((p) => p.key === "utm_medium")!.value).toBe("CPC");
  });

  it("replaces spaces with underscores in values", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=spring%20sale"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.utmParams.find((p) => p.key === "utm_campaign")!.value).toBe("spring_sale");
  });

  it("reorders params to canonical order", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_campaign=test&utm_source=google&utm_medium=cpc"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.utmParams[0].key).toBe("utm_source");
    expect(cleaned.utmParams[1].key).toBe("utm_medium");
    expect(cleaned.utmParams[2].key).toBe("utm_campaign");
  });

  it("removes trailing slash from pathname", () => {
    const parsed = parseUrlRow(
      "https://example.com/page/?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.pathname).toBe("/page");
  });

  it("strips fragment when stripFragment is true", () => {
    const ruleset: RulesetConfig = { ...defaultRuleset, stripFragment: true };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test#section"
    );
    const cleaned = cleanFormatting(parsed, ruleset);
    expect(cleaned.fragment).toBe("");
  });

  it("preserves fragment when stripFragment is false", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test#section"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.fragment).toBe("section");
  });

  it("does not modify a URL with parseError", () => {
    const parsed = parseUrlRow("not-a-url");
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned).toEqual(parsed);
  });

  it("preserves original rawKey from parsing", () => {
    const parsed = parseUrlRow(
      "https://example.com?UTM_SOURCE=google&utm_medium=cpc&utm_campaign=test"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    expect(cleaned.utmParams.find((p) => p.key === "utm_source")!.rawKey).toBe("UTM_SOURCE");
  });
});

describe("suggestSemanticFixes", () => {
  it("suggests closest allowed source when value is close", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "warn",
      allowedSources: ["google", "facebook", "twitter"],
    };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=googel&utm_medium=cpc&utm_campaign=test"
    );
    const patches = suggestSemanticFixes(parsed, ruleset);
    expect(patches).toHaveLength(1);
    expect(patches[0].kind).toBe("SEMANTIC");
    expect(patches[0].field).toBe("utm_source");
    expect(patches[0].after).toBe("google");
  });

  it("returns no patches when value already matches allowed list", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "warn",
      allowedSources: ["google"],
    };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const patches = suggestSemanticFixes(parsed, ruleset);
    expect(patches).toHaveLength(0);
  });

  it("returns no patches when value is too far from any allowed value", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "warn",
      allowedSources: ["google"],
    };
    const parsed = parseUrlRow(
      "https://example.com?utm_source=completely_different&utm_medium=cpc&utm_campaign=test"
    );
    const patches = suggestSemanticFixes(parsed, ruleset);
    expect(patches).toHaveLength(0);
  });

  it("does not suggest fixes for URLs with parseError", () => {
    const ruleset: RulesetConfig = {
      ...defaultRuleset,
      strictMode: "warn",
      allowedSources: ["google"],
    };
    const parsed = parseUrlRow("not-a-url");
    const patches = suggestSemanticFixes(parsed, ruleset);
    expect(patches).toHaveLength(0);
  });
});

describe("diffRows", () => {
  it("classifies case change as SAFE", () => {
    const original = parseUrlRow(
      "https://example.com?utm_source=Google&utm_medium=CPC&utm_campaign=Test"
    );
    const cleaned = cleanFormatting(original, defaultRuleset);
    const patches = diffRows(original, cleaned, defaultRuleset);
    const safePatches = patches.filter((p) => p.kind === "SAFE");
    expect(safePatches.length).toBeGreaterThan(0);
    const semanticPatches = patches.filter((p) => p.kind === "SEMANTIC");
    expect(semanticPatches).toHaveLength(0);
  });

  it("classifies value change as SEMANTIC", () => {
    const original = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const modified: ParsedUrl = {
      ...original,
      utmParams: original.utmParams.map((p) =>
        p.key === "utm_source" ? { ...p, value: "facebook" } : p
      ),
    };
    const patches = diffRows(original, modified, defaultRuleset);
    const semantic = patches.find(
      (p) => p.field === "utm_source" && p.kind === "SEMANTIC"
    );
    expect(semantic).toBeDefined();
    expect(semantic!.before).toBe("google");
    expect(semantic!.after).toBe("facebook");
  });

  it("detects trailing slash removal as SAFE", () => {
    const original = parseUrlRow(
      "https://example.com/page/?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const cleaned = cleanFormatting(original, defaultRuleset);
    const patches = diffRows(original, cleaned, defaultRuleset);
    const pathPatch = patches.find((p) => p.field === "pathname");
    expect(pathPatch).toBeDefined();
    expect(pathPatch!.kind).toBe("SAFE");
  });

  it("detects param reordering as SAFE", () => {
    const original = parseUrlRow(
      "https://example.com?utm_campaign=test&utm_source=google&utm_medium=cpc"
    );
    const cleaned = cleanFormatting(original, defaultRuleset);
    const patches = diffRows(original, cleaned, defaultRuleset);
    const orderPatch = patches.find((p) => p.field === "param_order");
    expect(orderPatch).toBeDefined();
    expect(orderPatch!.kind).toBe("SAFE");
  });

  it("detects fragment stripping as SAFE when stripFragment enabled", () => {
    const ruleset: RulesetConfig = { ...defaultRuleset, stripFragment: true };
    const original = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test#section"
    );
    const cleaned = cleanFormatting(original, ruleset);
    const patches = diffRows(original, cleaned, ruleset);
    const fragPatch = patches.find((p) => p.field === "fragment");
    expect(fragPatch).toBeDefined();
    expect(fragPatch!.kind).toBe("SAFE");
  });

  it("returns empty patches for identical URLs", () => {
    const original = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const cleaned = cleanFormatting(original, defaultRuleset);
    const patches = diffRows(cleaned, cleaned, defaultRuleset);
    expect(patches).toHaveLength(0);
  });

  it("returns empty for URLs with parseError", () => {
    const original = parseUrlRow("not-a-url");
    const cleaned = parseUrlRow("not-a-url");
    const patches = diffRows(original, cleaned, defaultRuleset);
    expect(patches).toHaveLength(0);
  });

  it("classifies duplicate count change as ERROR", () => {
    const original = parseUrlRow(
      "https://example.com?utm_source=google&utm_source=facebook&utm_medium=cpc&utm_campaign=test"
    );
    const modified: ParsedUrl = {
      ...original,
      utmParams: [
        { key: "utm_source", value: "google", rawKey: "utm_source" },
        { key: "utm_medium", value: "cpc", rawKey: "utm_medium" },
        { key: "utm_campaign", value: "test", rawKey: "utm_campaign" },
      ],
      duplicateKeys: [],
    };
    const patches = diffRows(original, modified, defaultRuleset);
    const errorPatch = patches.find((p) => p.kind === "ERROR");
    expect(errorPatch).toBeDefined();
    expect(errorPatch!.field).toBe("utm_source");
  });
});

describe("export", () => {
  it("reconstructUrl builds a valid URL string", () => {
    const parsed = parseUrlRow(
      "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=test#section"
    );
    const cleaned = cleanFormatting(parsed, defaultRuleset);
    const url = reconstructUrl(cleaned);
    expect(url).toContain("https://example.com/page");
    expect(url).toContain("utm_source=google");
    expect(url).toContain("utm_medium=cpc");
    expect(url).toContain("utm_campaign=test");
    expect(url).toContain("#section");
  });

  it("toUrlList outputs one URL per line", () => {
    const rows = [
      parseUrlRow("https://a.com?utm_source=g&utm_medium=c&utm_campaign=t"),
      parseUrlRow("https://b.com?utm_source=f&utm_medium=e&utm_campaign=u"),
    ];
    const output = toUrlList(rows);
    const lines = output.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("a.com");
    expect(lines[1]).toContain("b.com");
  });

  it("toTSV includes headers and tab-separated values", () => {
    const rows = [
      parseUrlRow("https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"),
    ];
    const cleaned = rows.map((r) => cleanFormatting(r, defaultRuleset));
    const output = toTSV(cleaned);
    const lines = output.split("\n");
    expect(lines[0]).toContain("url");
    expect(lines[0]).toContain("\t");
    expect(lines[1]).toContain("example.com");
    expect(lines[1].split("\t").length).toBeGreaterThanOrEqual(4);
  });

  it("toCSV includes headers and comma-separated values", () => {
    const rows = [
      parseUrlRow("https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"),
    ];
    const cleaned = rows.map((r) => cleanFormatting(r, defaultRuleset));
    const output = toCSV(cleaned);
    const lines = output.split("\n");
    expect(lines[0]).toContain("url");
    expect(lines[0]).toContain(",");
    expect(lines[1]).toContain("example.com");
  });

  it("toCSV escapes values containing commas", () => {
    const parsed = parseUrlRow(
      "https://example.com?utm_source=google&utm_medium=cpc&utm_campaign=test"
    );
    const modified: ParsedUrl = {
      ...parsed,
      utmParams: parsed.utmParams.map((p) =>
        p.key === "utm_campaign" ? { ...p, value: "spring,sale" } : p
      ),
    };
    const output = toCSV([modified]);
    expect(output).toContain('"spring,sale"');
  });

  it("reconstructUrl returns raw for parseError URLs", () => {
    const parsed = parseUrlRow("not-a-url");
    expect(reconstructUrl(parsed)).toBe("not-a-url");
  });
});
