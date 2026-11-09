/**
 * Tabellenexport nach dem Muster von Business Ultra (funnelExport):
 * Kopfblock, aktive Filter, dann Zeilen. CSV mit Semikolon und BOM,
 * JSON als Roh-Payload, XLS als Excel-XML, PDF als Druckseite.
 * Es werden nur die übergebenen (sichtbaren) Spalten geschrieben.
 */

export type TableExportFormat = "csv" | "json" | "xls" | "pdf";

export type TableExportPayload = {
  appName: string;
  tableName: string;
  exportedAt: string;
  filters: { label: string; value: string }[];
  columns: { key: string; label: string }[];
  rows: Record<string, string | number | null>[];
};

export function formatIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function sanitizePart(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") || "Export";
}

export function buildTableFilename(payload: Pick<TableExportPayload, "appName" | "tableName" | "exportedAt">): string {
  return `${sanitizePart(payload.appName)}_${sanitizePart(payload.tableName)}_${sanitizePart(payload.exportedAt)}`;
}

export function metaRows(payload: TableExportPayload): string[][] {
  const rows: string[][] = [
    ["Tabelle", payload.tableName],
    ["App", payload.appName],
    ["Datum", payload.exportedAt],
    [],
  ];
  rows.push(["Filter"]);
  if (payload.filters.length === 0) rows.push(["Keine aktiven Filter"]);
  else for (const filter of payload.filters) rows.push([filter.label, filter.value]);
  rows.push([]);
  return rows;
}

function tableHeader(payload: TableExportPayload): string[] {
  return payload.columns.map((column) => column.label);
}

function cellStr(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

function tableBody(payload: TableExportPayload): string[][] {
  return payload.rows.map((row) => payload.columns.map((column) => cellStr(row[column.key])));
}

function escapeCsv(value: string): string {
  if (/[;"\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(payload: TableExportPayload): string {
  const lines: string[] = [];
  for (const row of metaRows(payload)) lines.push(row.map(escapeCsv).join(";"));
  lines.push(tableHeader(payload).map(escapeCsv).join(";"));
  for (const row of tableBody(payload)) lines.push(row.map(escapeCsv).join(";"));
  return `\uFEFF${lines.join("\n")}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toSpreadsheetMl(payload: TableExportPayload): string {
  const allRows = [...metaRows(payload), tableHeader(payload), ...tableBody(payload)];
  const xmlRows = allRows
    .map((cells) => {
      const data = cells.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`).join("");
      return `<Row>${data}</Row>`;
    })
    .join("");
  const sheet = sanitizePart(payload.tableName).slice(0, 31) || "Export";
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheet)}">
  <Table>${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function toPrintHtml(payload: TableExportPayload, title: string): string {
  const meta = metaRows(payload)
    .filter((row) => row.length > 0)
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  const head = tableHeader(payload).map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = tableBody(payload)
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body{font:12px/1.4 system-ui,sans-serif;color:#111;margin:24px}
  h1{font-size:16px;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;margin:0 0 16px}
  th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f3f4f6;font-size:11px}
  .meta td{border:0;padding:2px 6px 2px 0}
  @media print{body{margin:8mm}}
</style></head><body>
<h1>${escapeHtml(title)}</h1>
<table class="meta">${meta}</table>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.onload=function(){setTimeout(function(){window.print()},50)}<\/script>
</body></html>`;
}

export type BuiltExport =
  | { kind: "file"; filename: string; mime: string; body: string }
  | { kind: "print"; filename: string; html: string };

export function buildTableExport(payload: TableExportPayload, format: TableExportFormat): BuiltExport {
  const base = buildTableFilename(payload);
  if (format === "csv") return { kind: "file", filename: `${base}.csv`, mime: "text/csv;charset=utf-8", body: toCsv(payload) };
  if (format === "json") {
    return { kind: "file", filename: `${base}.json`, mime: "application/json;charset=utf-8", body: JSON.stringify(payload, null, 2) };
  }
  if (format === "xls") {
    return { kind: "file", filename: `${base}.xls`, mime: "application/vnd.ms-excel;charset=utf-8", body: toSpreadsheetMl(payload) };
  }
  return { kind: "print", filename: base, html: toPrintHtml(payload, base) };
}

type ValueColumn<Row> = {
  id: string;
  label: string;
  hideable?: boolean;
  value: (row: Row) => string | number | boolean | null | undefined;
};

/** Baut die Export-Payload nur aus sichtbaren Spalten und den bereits gefilterten Zeilen. */
export function payloadFromVisibleRows<Row>(options: {
  appName: string;
  tableName: string;
  filters: { label: string; value: string }[];
  columns: ValueColumn<Row>[];
  visibility: Record<string, boolean>;
  rows: Row[];
  now?: Date;
}): TableExportPayload {
  const columns = options.columns.filter((column) => column.hideable === false || options.visibility[column.id] !== false);
  return {
    appName: options.appName,
    tableName: options.tableName,
    exportedAt: formatIsoDate(options.now ?? new Date()),
    filters: options.filters,
    columns: columns.map((column) => ({ key: column.id, label: column.label })),
    rows: options.rows.map((row) => {
      const record: Record<string, string | number | null> = {};
      for (const column of columns) {
        const value = column.value(row);
        if (typeof value === "boolean") record[column.id] = value ? "ja" : "nein";
        else if (value == null) record[column.id] = "";
        else record[column.id] = value;
      }
      return record;
    }),
  };
}

export function downloadBlob(filename: string, mime: string, data: BlobPart): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Lädt die Datei oder öffnet die Druckansicht. Blockiertes Popup wird als HTML gespeichert. */
export function exportTable(payload: TableExportPayload, format: TableExportFormat): void {
  const built = buildTableExport(payload, format);
  if (built.kind === "file") {
    downloadBlob(built.filename, built.mime, built.body);
    return;
  }
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    downloadBlob(`${built.filename}.html`, "text/html;charset=utf-8", built.html);
    return;
  }
  popup.document.open();
  popup.document.write(built.html);
  popup.document.close();
}
