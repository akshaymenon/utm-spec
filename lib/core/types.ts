import { z } from "zod";

export const InputModeSchema = z.enum(["URL_LIST", "TSV_RANGE"]);
export type InputMode = z.infer<typeof InputModeSchema>;

export const SeveritySchema = z.enum(["Error", "Warning", "Info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const PatchKindSchema = z.enum(["SAFE", "SEMANTIC", "ERROR"]);
export type PatchKind = z.infer<typeof PatchKindSchema>;

export const RulesetConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().default("Default"),
  requiredParams: z.array(z.string()).default(["utm_source", "utm_medium", "utm_campaign"]),
  missingRequiredSeverity: z.enum(["error", "warn"]).default("error"),
  allowedSources: z.array(z.string()).default([]),
  allowedMediums: z.array(z.string()).default([]),
  allowedCampaigns: z.array(z.string()).default([]),
  caseRule: z.enum(["lower", "upper", "none"]).default("lower"),
  trimWhitespace: z.boolean().default(true),
  stripFragment: z.boolean().default(false),
  strictMode: z.enum(["off", "warn", "block"]).default("off"),
  hostDomain: z.string().optional(),
});
export type RulesetConfig = z.infer<typeof RulesetConfigSchema>;

export const UtmParamSchema = z.object({
  key: z.string(),
  value: z.string(),
  rawKey: z.string(),
});
export type UtmParam = z.infer<typeof UtmParamSchema>;

export const ParsedUrlSchema = z.object({
  raw: z.string(),
  protocol: z.string(),
  host: z.string(),
  pathname: z.string(),
  utmParams: z.array(UtmParamSchema),
  otherParams: z.record(z.string()),
  fragment: z.string(),
  duplicateKeys: z.array(z.string()),
  parseError: z.string().optional(),
});
export type ParsedUrl = z.infer<typeof ParsedUrlSchema>;

export const LintIssueSchema = z.object({
  rowIndex: z.number(),
  field: z.string(),
  severity: SeveritySchema,
  code: z.string(),
  message: z.string(),
});
export type LintIssue = z.infer<typeof LintIssueSchema>;

export const PatchSchema = z.object({
  rowIndex: z.number(),
  field: z.string(),
  kind: PatchKindSchema,
  before: z.string(),
  after: z.string(),
  description: z.string(),
});
export type Patch = z.infer<typeof PatchSchema>;

export const ParseRowSchema = z.object({
  rowIndex: z.number(),
  cells: z.array(z.string()),
  url: ParsedUrlSchema.optional(),
  issues: z.array(LintIssueSchema),
  patches: z.array(PatchSchema),
});
export type ParseRow = z.infer<typeof ParseRowSchema>;

export const DraftPayloadSchema = z.object({
  inputRaw: z.string(),
  inputMode: InputModeSchema,
  rulesetConfig: RulesetConfigSchema,
  timestamp: z.number(),
});
export type DraftPayload = z.infer<typeof DraftPayloadSchema>;
