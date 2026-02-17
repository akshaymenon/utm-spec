import type { ParsedUrl } from "./types";

export function reconstructUrl(parsed: ParsedUrl): string {
  if (parsed.parseError) {
    return parsed.raw;
  }

  let url = `${parsed.protocol}://${parsed.host}${parsed.pathname}`;

  const params: string[] = [];
  for (const p of parsed.utmParams) {
    params.push(`${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
  }
  for (const [key, value] of Object.entries(parsed.otherParams)) {
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }

  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }

  if (parsed.fragment) {
    url += `#${parsed.fragment}`;
  }

  return url;
}

export function toUrlList(rows: ParsedUrl[]): string {
  return rows.map((r) => reconstructUrl(r)).join("\n");
}

export function toTSV(
  rows: ParsedUrl[],
  originalShape?: { headers: string[]; urlColumnIndex: number }
): string {
  if (originalShape) {
    const lines: string[] = [originalShape.headers.join("\t")];
    for (const row of rows) {
      const cells = originalShape.headers.map((_, i) => {
        if (i === originalShape.urlColumnIndex) {
          return reconstructUrl(row);
        }
        return "";
      });
      lines.push(cells.join("\t"));
    }
    return lines.join("\n");
  }

  const allUtmKeys = new Set<string>();
  for (const row of rows) {
    for (const p of row.utmParams) {
      allUtmKeys.add(p.key);
    }
  }

  const utmKeyList = Array.from(allUtmKeys).sort();
  const headers = ["url", ...utmKeyList];
  const lines: string[] = [headers.join("\t")];

  for (const row of rows) {
    const url = reconstructUrl(row);
    const values = utmKeyList.map((key) => {
      const param = row.utmParams.find((p) => p.key === key);
      return param ? param.value : "";
    });
    lines.push([url, ...values].join("\t"));
  }

  return lines.join("\n");
}

export function toCSV(rows: ParsedUrl[]): string {
  const allUtmKeys = new Set<string>();
  for (const row of rows) {
    for (const p of row.utmParams) {
      allUtmKeys.add(p.key);
    }
  }

  const utmKeyList = Array.from(allUtmKeys).sort();
  const headers = ["url", ...utmKeyList];
  const lines: string[] = [headers.map(csvEscape).join(",")];

  for (const row of rows) {
    const url = reconstructUrl(row);
    const values = utmKeyList.map((key) => {
      const param = row.utmParams.find((p) => p.key === key);
      return param ? param.value : "";
    });
    lines.push([url, ...values].map(csvEscape).join(","));
  }

  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
