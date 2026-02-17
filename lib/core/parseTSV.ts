import Papa from "papaparse";

export interface TSVParseResult {
  rows: string[][];
}

export function parseTSVRange(inputRaw: string): TSVParseResult {
  const result = Papa.parse<string[]>(inputRaw, {
    delimiter: "\t",
    header: false,
    skipEmptyLines: false,
    quoteChar: '"',
    escapeChar: '"',
  });

  const rows = result.data.filter((row) => {
    return row.some((cell) => cell.trim().length > 0);
  });

  return { rows };
}

const URL_PATTERN = /^https?:\/\//i;

export function detectLikelyUrlColumns(rows: string[][]): number[] {
  if (rows.length === 0) return [];

  const maxCols = Math.max(...rows.map((r) => r.length));
  const urlColumns: number[] = [];

  for (let col = 0; col < maxCols; col++) {
    let urlCount = 0;
    let nonEmptyCount = 0;

    for (const row of rows) {
      const cell = (row[col] ?? "").trim();
      if (cell.length === 0) continue;
      nonEmptyCount++;
      if (URL_PATTERN.test(cell)) urlCount++;
    }

    if (nonEmptyCount > 0 && urlCount / nonEmptyCount >= 0.5) {
      urlColumns.push(col);
    }
  }

  return urlColumns;
}
