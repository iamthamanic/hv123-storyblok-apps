import { describe, expect, it } from "vitest";
import { defaultVisibility, isColumnVisible, resolveColumnVisibility } from "@/lib/columns";
import { buildTableExport, buildTableFilename, payloadFromVisibleRows, toCsv } from "@/lib/table-export";

const columns = [
  { id: "name", label: "Seitenname", value: (row: { name: string; note: string }) => row.name },
  { id: "note", label: "Notiz", value: (row: { name: string; note: string }) => row.note },
];

describe("Spalten und Export", () => {
  it("blendet gespeicherte Spalten aus und setzt gesperrte Spalten nicht auf unsichtbar", () => {
    const defs = [
      { id: "name", label: "Name" },
      { id: "note", label: "Notiz", defaultVisible: false },
      { id: "edit", label: "Aktion", hideable: false },
    ];
    expect(defaultVisibility(defs).note).toBe(false);
    const resolved = resolveColumnVisibility(defs, { name: false, edit: false, unknown: false });
    expect(resolved.name).toBe(false);
    expect(resolved.edit).toBe(true);
    expect(isColumnVisible(defs[2]!, resolved)).toBe(true);
  });

  it("exportiert nur sichtbare Spalten, Filter und einen Kopfblock", () => {
    const payload = payloadFromVisibleRows({
      appName: "Seiten-Check",
      tableName: "Alle Seiten",
      filters: [{ label: "Suche", value: "Berlin" }],
      columns,
      visibility: { name: true, note: false },
      rows: [{ name: "Halteverbot Berlin", note: "geheim" }],
      now: new Date("2026-11-08T12:00:00"),
    });
    expect(payload.columns.map((column) => column.key)).toEqual(["name"]);
    expect(payload.rows[0]).toEqual({ name: "Halteverbot Berlin" });
    expect(buildTableFilename(payload)).toBe("Seiten-Check_Alle_Seiten_2026-11-08");
    const csv = toCsv(payload);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Tabelle;Alle Seiten");
    expect(csv).toContain("Datum;2026-11-08");
    expect(csv).toContain("Suche;Berlin");
    expect(csv).toContain("Seitenname");
    expect(csv).not.toContain("geheim");
    expect(csv.split("\n")[0]).toContain(";");
  });

  it("schreibt JSON roh, XLS als Excel-XML und PDF als Druckseite", () => {
    const payload = payloadFromVisibleRows({
      appName: "Scriptverwaltung",
      tableName: "Scripts",
      filters: [],
      columns,
      visibility: { name: true, note: true },
      rows: [{ name: 'Termly "Consent"', note: "Pflicht" }],
      now: new Date("2026-11-08T08:00:00"),
    });
    const json = buildTableExport(payload, "json");
    expect(json.kind).toBe("file");
    if (json.kind === "file") {
      expect(json.filename.endsWith(".json")).toBe(true);
      expect(JSON.parse(json.body).rows[0].name).toBe('Termly "Consent"');
    }
    const xls = buildTableExport(payload, "xls");
    if (xls.kind === "file") {
      expect(xls.body).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(xls.body).toContain("<Data ss:Type=\"String\">Termly &quot;Consent&quot;</Data>");
      expect(xls.filename.endsWith(".xls")).toBe(true);
    }
    const pdf = buildTableExport(payload, "pdf");
    expect(pdf.kind).toBe("print");
    if (pdf.kind === "print") {
      expect(pdf.html).toContain("window.print()");
      expect(pdf.html).toContain("Scriptverwaltung_Scripts_2026-11-08");
      expect(pdf.html).toContain("Keine aktiven Filter");
    }
  });
});
