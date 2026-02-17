import type { ParseRow, Patch, ParsedUrl } from "../../../../lib/core/types";
import { reconstructUrl } from "../../../../lib/core/export";
import { BrutalDrawer } from "../brutal/Drawer";
import { BrutalChip } from "../brutal/Chip";
import { BrutalButton } from "../brutal/Button";
import { BrutalCard, BrutalCardContent } from "../brutal/Card";
import { Check, X, ArrowRight } from "lucide-react";

interface RowReviewDrawerProps {
  open: boolean;
  onClose: () => void;
  row: ParseRow | null;
  originalUrl: string;
  approvedPatches: Set<string>;
  onToggleApproval: (patchKey: string) => void;
}

function patchKey(p: Patch): string {
  return `${p.rowIndex}:${p.field}:${p.before}:${p.after}`;
}

function kindColor(kind: string): "ok" | "warn" | "error" | "info" {
  if (kind === "SAFE") return "ok";
  if (kind === "SEMANTIC") return "warn";
  if (kind === "ERROR") return "error";
  return "info";
}

export function RowReviewDrawer({
  open,
  onClose,
  row,
  originalUrl,
  approvedPatches,
  onToggleApproval,
}: RowReviewDrawerProps) {
  if (!row) return null;

  const cleanedUrl = row.url ? reconstructUrl(row.url) : originalUrl;

  return (
    <BrutalDrawer open={open} onClose={onClose} title={`Row ${row.rowIndex + 1} Review`}>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-bold mb-1">Original URL</h3>
          <div
            className="brutal-input w-full break-all text-xs"
            data-testid="text-original-url"
          >
            {originalUrl}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold mb-1">Cleaned URL</h3>
          <div
            className="brutal-input w-full break-all text-xs bg-brutal-ok/10"
            data-testid="text-cleaned-url"
          >
            {cleanedUrl}
          </div>
        </div>

        {row.issues.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2">Issues</h3>
            <div className="space-y-1">
              {row.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs">
                  <BrutalChip severity={issue.severity === "Error" ? "error" : issue.severity === "Warning" ? "warn" : "info"}>
                    {issue.code}
                  </BrutalChip>
                  <span className="pt-0.5" data-testid={`text-issue-${idx}`}>{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {row.patches.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2">Patches</h3>
            <div className="space-y-2">
              {row.patches.map((patch, idx) => {
                const key = patchKey(patch);
                const isApproved = approvedPatches.has(key);
                const isSemantic = patch.kind === "SEMANTIC";

                return (
                  <BrutalCard key={idx}>
                    <BrutalCardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <BrutalChip severity={kindColor(patch.kind)}>
                              {patch.kind}
                            </BrutalChip>
                            <span className="text-xs font-mono font-bold">{patch.field}</span>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-mono bg-brutal-alert/10 px-1 line-through" data-testid={`text-patch-before-${idx}`}>
                                {patch.before || "(empty)"}
                              </span>
                              <ArrowRight className="h-3 w-3 flex-shrink-0" />
                              <span className="font-mono bg-brutal-ok/10 px-1" data-testid={`text-patch-after-${idx}`}>
                                {patch.after || "(empty)"}
                              </span>
                            </div>
                            <p className="text-muted-foreground" data-testid={`text-patch-desc-${idx}`}>{patch.description}</p>
                          </div>
                        </div>

                        {isSemantic && (
                          <BrutalButton
                            variant={isApproved ? "primary" : "secondary"}
                            size="sm"
                            onClick={() => onToggleApproval(key)}
                            data-testid={`button-approve-patch-${idx}`}
                          >
                            {isApproved ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {isApproved ? "Approved" : "Approve"}
                          </BrutalButton>
                        )}
                      </div>
                    </BrutalCardContent>
                  </BrutalCard>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BrutalDrawer>
  );
}

export { patchKey };
