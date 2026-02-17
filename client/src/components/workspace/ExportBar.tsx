import type { ParsedUrl } from "../../../../lib/core/types";
import { toUrlList, toTSV, toCSV } from "../../../../lib/core/export";
import { BrutalButton, BrutalChip } from "../brutal";
import { Copy, Lock } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../lib/auth";

interface ExportBarProps {
  cleanedUrls: ParsedUrl[];
  onPaywall?: (feature: string) => void;
}

export function ExportBar({ cleanedUrls, onPaywall }: ExportBarProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const { csvExport } = useAuth();

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  }

  const hasData = cleanedUrls.length > 0;

  function handleCsvClick() {
    if (!csvExport) {
      onPaywall?.("CSV export");
      return;
    }
    copyToClipboard(toCSV(cleanedUrls), "csv");
  }

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="export-bar">
      <span className="text-sm font-bold">Export:</span>

      <BrutalButton
        variant="secondary"
        size="sm"
        disabled={!hasData}
        onClick={() => copyToClipboard(toUrlList(cleanedUrls), "urls")}
        data-testid="button-copy-urls"
      >
        <Copy className="h-3 w-3" />
        {copied === "urls" ? "Copied" : "Copy URLs"}
      </BrutalButton>

      <BrutalButton
        variant="secondary"
        size="sm"
        disabled={!hasData}
        onClick={() => copyToClipboard(toTSV(cleanedUrls), "tsv")}
        data-testid="button-copy-tsv"
      >
        <Copy className="h-3 w-3" />
        {copied === "tsv" ? "Copied" : "Copy TSV"}
      </BrutalButton>

      <BrutalButton
        variant={csvExport ? "secondary" : "ghost"}
        size="sm"
        disabled={!hasData}
        onClick={handleCsvClick}
        data-testid="button-copy-csv"
      >
        {csvExport ? (
          <Copy className="h-3 w-3" />
        ) : (
          <Lock className="h-3 w-3" />
        )}
        {copied === "csv" ? "Copied" : "Copy CSV"}
        {!csvExport && <BrutalChip severity="info">Pro</BrutalChip>}
      </BrutalButton>

      {hasData && (
        <BrutalChip severity="ok" data-testid="chip-row-count">
          {cleanedUrls.length} row{cleanedUrls.length !== 1 ? "s" : ""}
        </BrutalChip>
      )}
    </div>
  );
}
