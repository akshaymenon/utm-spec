import type { InputMode } from "./types";

export function detectInputMode(inputRaw: string): InputMode {
  const trimmed = inputRaw.trim();
  if (!trimmed) return "URL_LIST";

  const lines = trimmed.split("\n").filter((l) => l.trim().length > 0);

  const tabCount = lines.filter((line) => line.includes("\t")).length;
  const tabRatio = tabCount / lines.length;

  if (tabRatio >= 0.5) return "TSV_RANGE";

  const urlPattern = /^https?:\/\//i;
  const urlCount = lines.filter((line) => urlPattern.test(line.trim())).length;
  const urlRatio = urlCount / lines.length;

  if (urlRatio >= 0.5) return "URL_LIST";

  if (tabCount > 0) return "TSV_RANGE";

  return "URL_LIST";
}
