import type { RedirectStatus } from "emdash/plugin";
import { localPath, redirectIssues } from "./redirects.js";

export const redirectCsvLimit = 24000;
export const redirectRowLimit = 50;
const statuses: RedirectStatus[] = [301, 302, 307, 308, 410, 451];
const placeholder = /\[(?:\.\.\.)?(\w+)\]/g;

export interface RedirectImportRow {
  line: number;
  source: string;
  destination: string;
  type: RedirectStatus;
  enabled: boolean;
  pattern: boolean;
}

function csvRecords(csv: string) {
  const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/y;
  const records: { line: number; cells: string[] }[] = [];
  let line = 1;
  let recordLine = line;
  let cells: string[] = [];
  do {
    const match = field.exec(csv);
    if (!match) throw new Error(`CSV line ${line} has invalid quoting`);
    const [, quoted, plain, separator] = match;
    cells.push(
      quoted === undefined ? (plain ?? "") : quoted.replaceAll('""', '"'),
    );
    line += (match[0].match(/\r\n|\r|\n/g) ?? []).length;
    if (separator !== ",") {
      if (cells.length !== 1 || cells[0]?.trim()) {
        records.push({ line: recordLine, cells });
      }
      cells = [];
      recordLine = line;
    }
  } while (field.lastIndex < csv.length || cells.length > 0);
  return records;
}

function validatePaths(source: string, destination: string) {
  const segments = source.split("/");
  const names = new Set<string>();
  for (const [index, segment] of segments.entries()) {
    const match = /^\[(\.\.\.)?(\w+)\]$/.exec(segment);
    if (!match) continue;
    const [, catchAll, name] = match;
    if (
      !name ||
      names.has(name) ||
      ["__proto__", "constructor", "prototype"].includes(name)
    ) {
      throw new Error("Use unique, safe pattern parameter names");
    }
    if (catchAll && segments.slice(index + 1).some(Boolean)) {
      throw new Error("A catch-all parameter must be in the last segment");
    }
    names.add(name);
    segments[index] = "parameter";
  }
  const sourcePath = segments.join("/");
  localPath(sourcePath);
  decodeURIComponent(sourcePath);
  if (destination) {
    const path = destination.replace(placeholder, (_, name: string) => {
      if (!names.has(name))
        throw new Error(
          `Destination parameter [${name}] is missing from the source`,
        );
      return "parameter";
    });
    if (/[\s\\\u0000-\u001f\u007f[\]]/u.test(path))
      throw new Error("Invalid destination path");
    localPath(path.split(/[?#]/, 1)[0] ?? "");
    decodeURIComponent(path);
    if (source === destination.split(/[?#]/, 1)[0]) {
      throw new Error("A redirect cannot target itself");
    }
  }
  return names.size > 0;
}

export function parseRedirectCsv(input: unknown): RedirectImportRow[] {
  if (typeof input !== "string" || input.length > redirectCsvLimit) {
    throw new Error(`Paste CSV up to ${redirectCsvLimit} characters`);
  }
  const records = csvRecords(input.replace(/^\uFEFF/, ""));
  const header = records
    .shift()
    ?.cells.map((cell) => cell.trim().toLowerCase());
  if (
    !header ||
    header.some((cell) => cell.includes(",")) ||
    !/^source,destination,type(?:,enabled)?(?:,pattern)?$/.test(
      header.join(","),
    )
  ) {
    throw new Error(
      "Use the CSV header source,destination,type with optional enabled and pattern columns",
    );
  }
  if (!records.length || records.length > redirectRowLimit) {
    throw new Error(`Supply 1 to ${redirectRowLimit} redirect rows per import`);
  }
  const sources = new Set<string>();
  const rows = records.map(({ line, cells }) => {
    try {
      const [source = "", destination = "", status] = cells.map((cell) =>
        cell.trim(),
      );
      const type = statuses.find((code) => String(code) === status);
      const enabled = (cells[header.indexOf("enabled")] ?? "true")
        .trim()
        .toLowerCase();
      const declaredPattern = cells[header.indexOf("pattern")]
        ?.trim()
        .toLowerCase();
      if (cells.length !== header.length)
        throw new Error("Column count differs from the header");
      if (!type) throw new Error("Use status 301, 302, 307, 308, 410, or 451");
      if (enabled !== "true" && enabled !== "false")
        throw new Error("Enabled must be true or false");
      if (source.length > 2048 || destination.length > 2048)
        throw new Error("Paths must be at most 2048 characters");
      if (type === 410 || type === 451) {
        if (destination)
          throw new Error("Leave the destination blank for 410 and 451");
      } else if (!destination.startsWith("/")) {
        throw new Error("Use a site-relative destination beginning with /");
      }
      const pattern = validatePaths(source, destination);
      if (
        declaredPattern !== undefined &&
        declaredPattern !== String(pattern)
      ) {
        throw new Error(
          "Pattern must be true for a path with parameters and false for an exact path",
        );
      }
      if (sources.has(source)) throw new Error("Duplicate source in this CSV");
      sources.add(source);
      return {
        line,
        source,
        destination,
        type,
        enabled: enabled === "true",
        pattern,
      };
    } catch (error) {
      throw new Error(
        `CSV line ${line}: ${error instanceof Error ? error.message : "Invalid redirect"}`,
      );
    }
  });
  const loop = redirectIssues(
    rows
      .filter((row) => row.enabled && !row.pattern && row.destination)
      .map((row) => ({
        source: row.source,
        destination: row.destination.split(/[?#]/, 1)[0] ?? "",
      })),
  ).find((issue) => issue.issue === "Redirect loop");
  if (loop)
    throw new Error(`The CSV contains a redirect loop at ${loop.source}`);
  return rows;
}
