"use client";

/**
 * Gemeinsames Tabellenmenü für Seiten-Check und Scriptverwaltung.
 * Ort: /components/table/TableToolsMenu.tsx
 *
 * Spiegelt Business Ultra (FunnelExportMenu + funnelExport):
 * 32×32 DotsThree, Menü schließt bei Klick außerhalb und Esc.
 * „Exportieren“ öffnet ein Modal mit Formatwahl + Spalten-Checkboxen (Vorbefüllung
 * aus der aktuellen Tabellenansicht). Exportiert werden nur die dort gewählten Spalten.
 * Zusätzlich „Spalten konfigurieren“ für die Tabellenansicht (localStorage).
 */

import { DotsThree, Export, FadersHorizontal, X } from "@phosphor-icons/react";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { columnStorageKey, defaultVisibility, isColumnVisible, resolveColumnVisibility, type ColumnMeta } from "@/lib/columns";
import { exportTable, payloadFromVisibleRows, type TableExportFormat } from "@/lib/table-export";

export type TableColumn<Row> = ColumnMeta & {
  value: (row: Row) => string | number | boolean | null | undefined;
};

type ToolsApi = {
  isVisible: (id: string) => boolean;
  menu: React.ReactNode;
};

const FORMATS: { format: TableExportFormat; label: string }[] = [
  { format: "csv", label: "CSV" },
  { format: "json", label: "JSON" },
  { format: "xls", label: "XLS" },
  { format: "pdf", label: "PDF" },
];

export function TableToolsMenu<Row>({
  tableId,
  appName,
  tableName,
  columns,
  rows,
  filters,
  className = "",
  children,
}: {
  tableId: string;
  appName: string;
  tableName: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  filters: { label: string; value: string }[];
  className?: string;
  children: (api: ToolsApi) => React.ReactNode;
}) {
  const titleId = useId();
  const columnsId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [format, setFormat] = useState<TableExportFormat>("csv");
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => defaultVisibility(columns));
  const [draft, setDraft] = useState<Record<string, boolean>>(() => defaultVisibility(columns));
  const [exportDraft, setExportDraft] = useState<Record<string, boolean>>(() => defaultVisibility(columns));
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let next: Record<string, boolean>;
    try {
      const raw = localStorage.getItem(columnStorageKey(tableId));
      next = resolveColumnVisibility(columns, raw ? JSON.parse(raw) : null);
    } catch {
      next = defaultVisibility(columns);
    }
    queueMicrotask(() => {
      setVisibility(next);
      setDraft(next);
    });
  }, [tableId, columns]);

  function closeColumns() {
    setColumnsOpen(false);
    setDraft(visibility);
  }

  useEffect(() => {
    if (!menuOpen && !columnsOpen) return;
    function dismiss() {
      setMenuOpen(false);
      setColumnsOpen(false);
      setDraft(visibility);
    }
    function onDoc(event: MouseEvent) {
      if (!root?.contains(event.target as Node)) dismiss();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, columnsOpen, root, visibility]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    dialog?.querySelector<HTMLElement>("button, input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, dialog]);

  function openColumns() {
    setMenuOpen(false);
    setDraft({ ...visibility });
    setColumnsOpen(true);
  }

  function toggleDraft(id: string) {
    const column = columns.find((item) => item.id === id);
    if (!column || column.hideable === false) return;
    setDraft((current) => ({ ...current, [id]: current[id] === false }));
  }

  function toggleExportDraft(id: string) {
    const column = columns.find((item) => item.id === id);
    if (!column || column.hideable === false) return;
    setExportDraft((current) => ({ ...current, [id]: current[id] === false }));
  }

  function showAllDraft() {
    setDraft(Object.fromEntries(columns.map((column) => [column.id, true])));
  }

  function showAllExportDraft() {
    setExportDraft(Object.fromEntries(columns.map((column) => [column.id, true])));
  }

  function resetDraft() {
    setDraft(defaultVisibility(columns));
  }

  function resetExportDraft() {
    setExportDraft({ ...visibility });
  }

  function applyColumns() {
    const resolved = resolveColumnVisibility(columns, draft);
    setVisibility(resolved);
    setDraft(resolved);
    try {
      const defaults = defaultVisibility(columns);
      const same = columns.every((column) => resolved[column.id] === defaults[column.id]);
      if (same) localStorage.removeItem(columnStorageKey(tableId));
      else localStorage.setItem(columnStorageKey(tableId), JSON.stringify(resolved));
    } catch {
      /* Private Mode */
    }
    setColumnsOpen(false);
  }

  function openModal() {
    setMenuOpen(false);
    closeColumns();
    setFormat("csv");
    setExportDraft({ ...visibility });
    setModalOpen(true);
  }

  const exportableColumns = columns.filter((column) => column.hideable === false || exportDraft[column.id] !== false);
  const canExport = exportableColumns.length > 0;

  function confirm() {
    if (!canExport) return;
    setModalOpen(false);
    exportTable(
      payloadFromVisibleRows({ appName, tableName, filters, columns, visibility: exportDraft, rows }),
      format,
    );
  }

  const menu = (
    <div ref={setRoot} className={`funnel-export-box ${className}`.trim()}>
      <button
        type="button"
        className="funnel-export-btn"
        aria-label="Tabellenmenü"
        aria-haspopup="menu"
        aria-expanded={menuOpen || columnsOpen}
        title="Export und Spalten"
        onClick={() => {
          if (columnsOpen) closeColumns();
          setMenuOpen((open) => !open);
        }}
      >
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="funnel-export-menu" role="menu">
          <button type="button" role="menuitem" className="funnel-export-item" onClick={openModal}>
            <Export size={16} weight="bold" aria-hidden />
            Exportieren
          </button>
          <button
            type="button"
            role="menuitem"
            className="funnel-export-item"
            aria-controls={columnsId}
            onClick={openColumns}
          >
            <FadersHorizontal size={16} weight="bold" aria-hidden />
            Spalten konfigurieren
          </button>
        </div>
      ) : null}
      {columnsOpen ? (
        <div className="funnel-export-menu is-columns" id={columnsId} role="dialog" aria-label="Spalten konfigurieren">
          <p className="funnel-export-kicker">Spalten konfigurieren</p>
          <div className="funnel-export-columns">
            {columns.filter((column) => column.hideable !== false).map((column) => (
              <label key={column.id} className="funnel-export-check">
                <input type="checkbox" checked={isColumnVisible(column, draft)} onChange={() => toggleDraft(column.id)} />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          <div className="funnel-export-col-actions">
            <button type="button" onClick={showAllDraft}>Alle anzeigen</button>
            <button type="button" onClick={resetDraft}>Zurücksetzen</button>
            <button type="button" className="is-primary" onClick={applyColumns}>Übernehmen</button>
          </div>
        </div>
      ) : null}
      {modalOpen
        ? createPortal(
            <div
              className="bu-modal-overlay"
              role="presentation"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setModalOpen(false);
              }}
            >
              <div ref={setDialog} className="bu-modal funnel-export-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
                <div className="bu-modal-head">
                  <h2 id={titleId} className="section-title">Exportieren</h2>
                  <button type="button" className="btn icon-btn" onClick={() => setModalOpen(false)} aria-label="Abbrechen">
                    <X size={16} weight="bold" aria-hidden />
                  </button>
                </div>
                <p className="muted page-lede">Format und Spalten wählen. Es werden nur die markierten Spalten exportiert.</p>
                <p className="funnel-export-kicker funnel-export-kicker-modal">Format</p>
                <div className="funnel-export-formats" role="radiogroup" aria-label="Format wählen">
                  {FORMATS.map((item) => (
                    <label key={item.format} className={`funnel-export-fmt${format === item.format ? " is-active" : ""}`}>
                      <input type="radio" name={`${tableId}-export-format`} value={item.format} checked={format === item.format} onChange={() => setFormat(item.format)} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <p className="funnel-export-kicker funnel-export-kicker-modal">Spalten</p>
                <div className="funnel-export-modal-columns" role="group" aria-label="Spalten für Export">
                  {columns.filter((column) => column.hideable !== false).map((column) => (
                    <label key={column.id} className="funnel-export-check">
                      <input type="checkbox" checked={isColumnVisible(column, exportDraft)} onChange={() => toggleExportDraft(column.id)} />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
                <div className="funnel-export-col-actions funnel-export-modal-col-actions">
                  <button type="button" onClick={showAllExportDraft}>Alle auswählen</button>
                  <button type="button" onClick={resetExportDraft}>Wie Tabelle</button>
                </div>
                {!canExport ? <p className="funnel-export-warn">Mindestens eine Spalte auswählen.</p> : null}
                <div className="bu-modal-actions">
                  <button type="button" className="btn" onClick={() => setModalOpen(false)}>Abbrechen</button>
                  <button type="button" className="btn primary" onClick={confirm} disabled={!canExport}>Exportieren</button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );

  return children({
    isVisible: (id: string) => {
      const column = columns.find((item) => item.id === id);
      if (!column) return true;
      return isColumnVisible(column, visibility);
    },
    menu,
  });
}
