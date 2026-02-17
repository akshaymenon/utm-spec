import { describe, it, expect } from "vitest";
import { parseTSVRange, detectLikelyUrlColumns } from "../parseTSV";

describe("parseTSVRange", () => {
  it("parses normal TSV with 3 cols, URL in col 2", () => {
    const input = [
      "Campaign A\thttps://example.com?utm_source=google&utm_medium=cpc\tactive",
      "Campaign B\thttps://example.com?utm_source=fb&utm_medium=social\tinactive",
      "Campaign C\thttps://example.com?utm_source=email&utm_medium=newsletter\tactive",
    ].join("\n");

    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveLength(3);
    expect(rows[0][0]).toBe("Campaign A");
    expect(rows[0][1]).toBe(
      "https://example.com?utm_source=google&utm_medium=cpc"
    );
    expect(rows[0][2]).toBe("active");
    expect(rows[1][0]).toBe("Campaign B");
    expect(rows[2][2]).toBe("active");
  });

  it("handles quoted cell containing newline", () => {
    const input = [
      'Campaign A\t"https://example.com\n?utm_source=google"\tactive',
      "Campaign B\thttps://example.com?utm_source=fb\tinactive",
    ].join("\n");

    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(2);
    expect(rows[0][1]).toBe("https://example.com\n?utm_source=google");
    expect(rows[0][2]).toBe("active");
    expect(rows[1][0]).toBe("Campaign B");
  });

  it("preserves trailing empty columns", () => {
    const input = [
      "Campaign A\thttps://example.com\t\t",
      "Campaign B\thttps://other.com\tnotes\t",
    ].join("\n");

    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(4);
    expect(rows[0][2]).toBe("");
    expect(rows[0][3]).toBe("");
    expect(rows[1][2]).toBe("notes");
    expect(rows[1][3]).toBe("");
  });

  it("handles mixed whitespace in cells", () => {
    const input = [
      "  Campaign A  \t  https://example.com  \t  active  ",
      "\thttp://test.com\t",
    ].join("\n");

    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(2);
    expect(rows[0][0]).toBe("  Campaign A  ");
    expect(rows[0][1]).toBe("  https://example.com  ");
    expect(rows[1][0]).toBe("");
    expect(rows[1][1]).toBe("http://test.com");
  });

  it("handles empty input", () => {
    const { rows } = parseTSVRange("");
    expect(rows).toHaveLength(0);
  });

  it("handles single cell input", () => {
    const { rows } = parseTSVRange("https://example.com");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(1);
    expect(rows[0][0]).toBe("https://example.com");
  });

  it("handles quoted cells with embedded tabs", () => {
    const input = '"cell\twith\ttabs"\tnormal cell';
    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("cell\twith\ttabs");
    expect(rows[0][1]).toBe("normal cell");
  });

  it("handles escaped quotes within quoted cells", () => {
    const input = '"He said ""hello"""\tnormal';
    const { rows } = parseTSVRange(input);

    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('He said "hello"');
    expect(rows[0][1]).toBe("normal");
  });
});

describe("detectLikelyUrlColumns", () => {
  it("detects URL column from parsed rows", () => {
    const rows = [
      ["Campaign A", "https://example.com?utm_source=google", "active"],
      ["Campaign B", "https://example.com?utm_source=fb", "inactive"],
      ["Campaign C", "https://example.com?utm_source=email", "active"],
    ];

    const urlCols = detectLikelyUrlColumns(rows);
    expect(urlCols).toEqual([1]);
  });

  it("detects multiple URL columns", () => {
    const rows = [
      ["https://source.com", "https://dest.com"],
      ["https://a.com", "https://b.com"],
    ];

    const urlCols = detectLikelyUrlColumns(rows);
    expect(urlCols).toEqual([0, 1]);
  });

  it("returns empty for no URLs", () => {
    const rows = [
      ["Campaign A", "active"],
      ["Campaign B", "inactive"],
    ];

    const urlCols = detectLikelyUrlColumns(rows);
    expect(urlCols).toEqual([]);
  });

  it("handles empty rows array", () => {
    const urlCols = detectLikelyUrlColumns([]);
    expect(urlCols).toEqual([]);
  });

  it("handles rows with different column counts", () => {
    const rows = [
      ["Campaign A", "https://example.com"],
      ["Campaign B", "https://example.com", "extra"],
    ];

    const urlCols = detectLikelyUrlColumns(rows);
    expect(urlCols).toEqual([1]);
  });
});
