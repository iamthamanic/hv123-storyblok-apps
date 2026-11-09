"use client";

/**
 * Tabellen-Bausteine für Seiten-Check (Toolbar, Filter, Zellen, Resize).
 * Ort: /components/seiten-check/table-parts.tsx
 */

import type { Edit, Filter } from "@/components/seiten-check/types";
import type { PagePatch, PageRecord } from "@/lib/types";

export function Toolbar({ search, setSearch, onCheck, menu }: { search: string; setSearch: (value: string) => void; onCheck: () => void; menu: React.ReactNode }) {
  return (
    <div className="sc-table-toolbar">
      <div className="sc-toolbar-left"><div className="sc-search"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Seite, Pfad oder Ziel-URL suchen ..." aria-label="Seiten durchsuchen" /></div></div>
      <div className="sc-toolbar-right">
        <button type="button" className="sc-filter-btn" onClick={onCheck}>Links prüfen</button>
        {menu}
      </div>
    </div>
  );
}

export function FilterLine({ filter, setFilter, counts, links = false }: { filter: Filter; setFilter: (filter: Filter) => void; counts: Record<Filter, number>; links?: boolean }) {
  const items: [Filter, string][] = links
    ? [["all", "Alle Seiten"], ["broken", "Mit Linkfehlern"], ["noindex", "Noindex"], ["pathless", "Ohne Real Path"]]
    : [["all", "Alle"], ["redirect", "Mit Redirect"], ["broken", "Mit Linkfehlern"], ["noindex", "Noindex"], ["pathless", "Ohne Real Path"]];
  return (
    <div className="sc-filterline">
      <span className="sc-filterlabel">FILTER</span>
      {items.map(([key, label]) => (
        <button key={key} type="button" className={`sc-filterchip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>
          <span>{label}</span>
          <em>{counts[key]}</em>
        </button>
      ))}
    </div>
  );
}

export function Th({ label, sortKey, sort, dir, onSort, width, onWidth, onReset }: { label: string; sortKey: string; sort: string; dir: "asc" | "desc"; onSort: (key: string) => void; width: number; onWidth: (width: number) => void; onReset: () => void }) {
  return (
    <th className="sc-headcol" style={{ width }}>
      <button type="button" className={`sc-th ${sort === sortKey ? "sorted" : ""}`} onClick={() => onSort(sortKey)}>{label} {sort === sortKey ? (dir === "asc" ? "↑" : "↓") : "↕"}</button>
      <span className="sc-col-resize" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Spaltenbreite ${label} verändern`} title="Ziehen: Breite ändern · Doppelklick: zurücksetzen" onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        const startX = event.clientX;
        const start = width;
        const move = (ev: PointerEvent) => onWidth(start + ev.clientX - startX);
        const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }} onDoubleClick={(event) => { event.preventDefault(); onReset(); }} onKeyDown={(event) => { if (event.key === "ArrowRight") onWidth(width + 20); if (event.key === "ArrowLeft") onWidth(width - 20); }} onClick={(event) => event.stopPropagation()} />
    </th>
  );
}

export function Cell({ page, field, editing, setEditing, save, placeholder = "—" }: { page: PageRecord; field: NonNullable<Edit>["field"]; editing: Edit; setEditing: (edit: Edit) => void; save: (id: string, patch: PagePatch) => Promise<void>; placeholder?: string }) {
  const current = page[field] ?? "";
  if (editing?.id === page.id && editing.field === field) {
    return <input className="sc-inline-input" autoFocus defaultValue={current} aria-label={field} onBlur={(event) => { setEditing(null); if (event.target.value !== current) void save(page.id, { [field]: event.target.value }); }} />;
  }
  return <button type="button" className="sc-code" onClick={() => setEditing({ id: page.id, field })}>{current || placeholder}</button>;
}

export function CanonicalCell({ page, editing, setEditing, save }: { page: PageRecord; editing: Edit; setEditing: (edit: Edit) => void; save: (id: string, patch: PagePatch) => Promise<void> }) {
  const current = page.canonical ?? "";
  const automatic = page.realPath || "—";
  if (editing?.id === page.id && editing.field === "canonical") {
    return <input className="sc-inline-input" autoFocus defaultValue={current} aria-label="Canonical" placeholder={page.realPath || ""} onBlur={(event) => { setEditing(null); if (event.target.value !== current) void save(page.id, { canonical: event.target.value }); }} />;
  }
  if (!current) {
    return (
      <button type="button" className="sc-code sc-canonical-auto" title="Automatisch aus Real Path" onClick={() => setEditing({ id: page.id, field: "canonical" })}>
        {automatic}
      </button>
    );
  }
  return <button type="button" className="sc-code" onClick={() => setEditing({ id: page.id, field: "canonical" })}>{current}</button>;
}

export function LinkCountButton({ count, label, primary = false, onClick }: { count: number; label: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`sc-link-count ${primary ? "primary" : ""} ${count === 0 ? "is-zero" : ""}`}
      aria-label={`${label}: ${count} anzeigen`}
      onClick={onClick}
    >
      {count}
    </button>
  );
}
