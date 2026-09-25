import { describe, it, expect } from "vitest";
import {
  csvEscape,
  csvHeader,
  csvRow,
  csvLines,
  csvLinesAsync,
  BOM,
  EXPORTABLE_COLUMNS,
  defaultColumns,
} from "@/lib/csv";

describe("csvEscape", () => {
  it("leaves simple values unquoted", () => {
    expect(csvEscape("Bright Smile")).toBe("Bright Smile");
    expect(csvEscape(42)).toBe("42");
  });

  it("quotes values containing a comma", () => {
    expect(csvEscape("Bright Smile, LLC")).toBe('"Bright Smile, LLC"');
  });

  it("doubles embedded double quotes (RFC 4180)", () => {
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes values containing a newline and normalises CRLF", () => {
    expect(csvEscape("line1\r\nline2")).toBe('"line1\nline2"');
  });

  it("renders null and undefined as an empty string", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("joins arrays with a semicolon", () => {
    expect(csvEscape(["a", "b", "c"])).toBe("a; b; c");
  });

  it("serialises objects as JSON", () => {
    expect(csvEscape({ a: 1 })).toBe('"{""a"":1}"');
  });

  /**
   * Spreadsheet formula injection: a cell starting with = + - @ or a control
   * character can execute in Excel/Sheets. We prefix a single quote so the
   * spreadsheet treats it as text.
   */
  it("neutralises formula injection", () => {
    expect(csvEscape("=1+1")).toBe("'=1+1");
    expect(csvEscape("+1+1")).toBe("'+1+1");
    expect(csvEscape("-1+1")).toBe("'-1+1");
    expect(csvEscape("@SUM(A1)")).toBe("'@SUM(A1)");
    // A leading tab is both risky and a quoting trigger, so it is neutralised
    // *and* quoted — the quote is what makes it a single well-formed cell.
    expect(csvEscape("\tfoo")).toBe("\"'\tfoo\"");
    // A leading CR becomes an LF during normalisation, so the cell is quoted.
    expect(csvEscape("\rfoo")).toBe("\"'\nfoo\"");
  });

  it("still neutralises a formula that also needs quoting", () => {
    expect(csvEscape('=HYPERLINK("http://x","click")')).toBe(
      `"'=HYPERLINK(""http://x"",""click"")"`,
    );
  });
});

describe("csvHeader / csvRow", () => {
  it("joins columns with commas", () => {
    expect(csvHeader(["a", "b"])).toBe("a,b");
  });

  it("quotes header values that need it", () => {
    expect(csvHeader(["a,b"])).toBe('"a,b"');
  });

  it("emits one cell per requested column, in order", () => {
    const row = csvRow(["b", "a"], { a: "1", b: "2,3", c: "ignored" });
    expect(row).toBe('"2,3",1');
  });

  it("emits empty cells for missing keys", () => {
    expect(csvRow(["a", "missing"], { a: "x" })).toBe("x,");
  });
});

describe("csvLines", () => {
  it("starts with a BOM, then the header, then one line per row", () => {
    const lines = [...csvLines(["a", "b"], [{ a: 1, b: 2 }, { a: 3, b: 4 }])];
    expect(lines[0]).toBe(BOM);
    expect(lines[1]).toBe("a,b\n");
    expect(lines[2]).toBe("1,2\n");
    expect(lines[3]).toBe("3,4\n");
    expect(lines).toHaveLength(4);
  });

  it("can omit the BOM", () => {
    const lines = [...csvLines(["a"], [], { bom: false })];
    expect(lines[0]).toBe("a\n");
  });
});

describe("csvLinesAsync", () => {
  it("streams an async iterable without buffering it whole", async () => {
    async function* source() {
      yield { a: 1 };
      yield { a: 2 };
    }
    const lines: string[] = [];
    for await (const line of csvLinesAsync(["a"], source())) lines.push(line);
    expect(lines).toEqual([BOM, "a\n", "1\n", "2\n"]);
  });

  it("handles an empty source", async () => {
    async function* empty() {
      /* no rows */
    }
    const lines: string[] = [];
    for await (const line of csvLinesAsync(["a"], empty())) lines.push(line);
    expect(lines).toEqual([BOM, "a\n"]);
  });
});

describe("export columns", () => {
  it("exposes a stable default column set", () => {
    expect(defaultColumns()).toContain("business_name");
    expect(defaultColumns()).toContain("email_status");
  });

  it("has no duplicate column keys", () => {
    expect(new Set(EXPORTABLE_COLUMNS).size).toBe(EXPORTABLE_COLUMNS.length);
  });
});
