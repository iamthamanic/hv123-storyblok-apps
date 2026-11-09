"use client";

/**
 * Gemeinsames Tabellenmenü für Seiten-Check und Scriptverwaltung.
 * Ort: /components/table/TableToolsMenu.tsx
 *
 * Spiegelt Business Ultra (FunnelExportMenu + funnelExport):
 * 32×32 DotsThree, Menü schließt bei Klick außerhalb und Esc.
 * „Exportieren“ öffnet ein Modal mit CSV/JSON/XLS/PDF (CSV vorausgewählt).
 * Zusätzlich „Spalten“: Checkboxen, Alle anzeigen, Zurücksetzen, localStorage je Tabelle.
 * Export enthält nur sichtbare Spalten und die übergebenen (gefilterten) Zeilen.
 */

import { DotsThree, X } from "@phosphor-icons/react";
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
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [dialog, setDialog] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(columnStorageKey(tableId));
      setVisibility(resolveColumnVisibility(columns, raw ? JSON.parse(raw) : null));
    } catch {
      setVisibility(defaultVisibility(columns));
    }
  }, [tableId, columns]);

  useEffect(() => {
    if (!menuOpen && !columnsOpen) return;
    function onDoc(event: MouseEvent) {
      if (!root?.contains(event.target as Node)) {
        setMenuOpen(false);
        setColumnsOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, columnsOpen, root]);

  useEffect(() => {
    if (!modalOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setModalOpen(false);
    }
    document.addEventListener("keydown", onKey);
    dialog?.querySelector<HTMLElement>("button, input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen, dialog]);

  function persist(next: Record<string, boolean>) {
    const resolved = resolveColumnVisibility(columns, next);
    setVisibility(resolved);
    try {
      localStorage.setItem(columnStorageKey(tableId), JSON.stringify(resolved));
    } catch {
      /* Private Mode */
    }
  }

  function toggle(id: string) {
    const column = columns.find((item) => item.id === id);
    if (!column || column.hideable === false) return;
    persist({ ...visibility, [id]: visibility[id] === false });
  }

  function showAll() {
    persist(Object.fromEntries(columns.map((column) => [column.id, true])));
  }

  function reset() {
    const next = defaultVisibility(columns);
    setVisibility(next);
    try {
      localStorage.removeItem(columnStorageKey(tableId));
    } catch {
      /* Private Mode */
    }
  }

  function openModal() {
    setMenuOpen(false);
    setColumnsOpen(false);
    setFormat("csv");
    setModalOpen(true);
  }

  function confirm() {
    setModalOpen(false);
    exportTable(
      payloadFromVisibleRows({ appName, tableName, filters, columns, visibility, rows }),
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
          setColumnsOpen(false);
          setMenuOpen((open) => !open);
        }}
      >
        <DotsThree size={20} weight="bold" aria-hidden />
      </button>
      {menuOpen ? (
        <div className="funnel-export-menu" role="menu">
          <button type="button" role="menuitem" className="funnel-export-item" onClick={openModal}>
            Exportieren
          </button>
          <button
            type="button"
            role="menuitem"
            className="funnel-export-item"
            aria-controls={columnsId}
            onClick={() => {
              setMenuOpen(false);
              setColumnsOpen(true);
            }}
          >
            Spalten
          </button>
        </div>
      ) : null}
      {columnsOpen ? (
        <div className="funnel-export-menu is-columns" id={columnsId} role="dialog" aria-label="Spalten">
          <p className="funnel-export-kicker">Spalten</p>
          <div className="funnel-export-columns">
            {columns.filter((column) => column.hideable !== false).map((column) => (
              <label key={column.id} className="funnel-export-check">
                <input type="checkbox" checked={isColumnVisible(column, visibility)} onChange={() => toggle(column.id)} />
                <span>{column.label}</span>
              </label>
            ))}
          </div>
          <div className="funnel-export-col-actions">
            <button type="button" onClick={showAll}>Alle anzeigen</button>
            <button type="button" onClick={reset}>Zurücksetzen</button>
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
                <p className="muted page-lede">Format wählen</p>
                <div className="funnel-export-formats" role="radiogroup" aria-label="Format wählen">
                  {FORMATS.map((item) => (
                    <label key={item.format} className={`funnel-export-fmt${format === item.format ? " is-active" : ""}`}>
                      <input type="radio" name={`${tableId}-export-format`} value={item.format} checked={format === item.format} onChange={() => setFormat(item.format)} />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
                <div className="bu-modal-actions">
                  <button type="button" className="btn" onClick={() => setModalOpen(false)}>Abbrechen</button>
                  <button type="button" className="btn primary" onClick={confirm}>Exportieren</button>
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
