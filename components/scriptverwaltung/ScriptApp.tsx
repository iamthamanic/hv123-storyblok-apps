"use client";

/**
 * Scriptverwaltung: Katalog, globaler Status, Lade-Reihenfolge. Snippets werden nur gespeichert.
 * Ort: /components/scriptverwaltung/ScriptApp.tsx
 */

import { CaretDown, CaretUp, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TableToolsMenu, type TableColumn } from "@/components/table/TableToolsMenu";
import { useColumnWidths } from "@/components/table/useColumnWidths";
import { clientApi, formatDeDate } from "@/components/shared/client-api";
import { moveScript, normalizeOrder, TERMLY_ID, upsertScript, validateScriptDraft } from "@/lib/order";
import { COOKIE_CATEGORIES, SCRIPT_TYPES, type CookieCategory, type ScriptRecord, type ScriptType } from "@/lib/types";

const WIDTHS: Record<string, number> = { name: 200, details: 160, source: 150, implementedAt: 120, reason: 170, note: 160, category: 130, active: 120, order: 90 };

const COLUMNS: TableColumn<ScriptRecord>[] = [
  { id: "name", label: "Scriptname", value: (script) => script.name },
  { id: "details", label: "Details", value: (script) => script.details },
  { id: "source", label: "Website / Quelle", value: (script) => script.websiteUrl || script.sourceText },
  { id: "implementedAt", label: "Implementiert", value: (script) => script.implementedAt },
  { id: "reason", label: "Implementierungsgrund", value: (script) => script.reason },
  { id: "note", label: "Notiz", value: (script) => script.note },
  { id: "category", label: "Cookie-Kategorie", value: (script) => script.category },
  { id: "active", label: "Status", value: (script) => (script.active ? "Aktiv" : "Inaktiv") },
  { id: "order", label: "Ladefolge", value: (script) => script.order },
];

const EMPTY: ScriptRecord = {
  id: "", name: "", details: "", websiteUrl: "", sourceText: "", implementedAt: new Date().toISOString().slice(0, 10),
  reason: "", note: "", snippet: "", category: "Analytik", type: "analytics", active: true, required: false, order: 99,
};

export function ScriptApp() {
  const [scripts, setScripts] = useState<ScriptRecord[] | null>(null);
  const [mode, setMode] = useState("mock");
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState("order");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [view, setView] = useState<"table" | "order">("table");
  const [draft, setDraft] = useState<ScriptRecord | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const widths = useColumnWidths("hv-widths-scripts", WIDTHS);

  async function load() {
    const data = await clientApi<{ scripts: ScriptRecord[]; mode: string }>("/api/scripts");
    setScripts(normalizeOrder(data.scripts));
    setMode(data.mode);
    setError("");
    setAuth(false);
  }

  useEffect(() => {
    load().catch((reason: Error & { code?: string }) => {
      setAuth(reason.code === "auth");
      setError(reason.message);
      setScripts([]);
    });
  }, []);

  function ping(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function persist(next: ScriptRecord[], message: string) {
    const saved = await clientApi<{ scripts: ScriptRecord[] }>("/api/scripts", { method: "PUT", body: JSON.stringify({ scripts: normalizeOrder(next) }) });
    setScripts(normalizeOrder(saved.scripts));
    ping(message);
  }

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("de");
    const list = (scripts ?? []).filter((script) => {
      if (filter === "active" && !script.active) return false;
      if (filter === "inactive" && script.active) return false;
      if (!q) return true;
      return [script.name, script.details, script.websiteUrl, script.sourceText, script.reason, script.note, script.category].join(" ").toLocaleLowerCase("de").includes(q);
    });
    return list.sort((a, b) => {
      const left = sort === "active" ? Number(a.active) : sort === "order" ? a.order : String((a as Record<string, unknown>)[sort] ?? "");
      const right = sort === "active" ? Number(b.active) : sort === "order" ? b.order : String((b as Record<string, unknown>)[sort] ?? "");
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "de", { numeric: true });
      return result * (dir === "asc" ? 1 : -1) || a.order - b.order;
    });
  }, [scripts, query, filter, sort, dir]);

  const filters = [
    { label: "Status", value: filter === "all" ? "Alle" : filter === "active" ? "Aktiv" : "Inaktiv" },
    ...(query.trim() ? [{ label: "Suche", value: query.trim() }] : []),
  ];
  const removing = scripts?.find((script) => script.id === removeId);

  function toggleSort(key: string) {
    setDir(sort === key && dir === "asc" ? "desc" : "asc");
    setSort(key);
  }

  return (
    <div className="script-app" id="scriptsView">
      <div className="shell">
        {error ? <p className="micro" role="alert">{error} {auth ? (
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/api/connect/scriptverwaltung/storyblok">Mit Storyblok verbinden</a>
          ) : null}</p> : null}
        <main className="panel">
          <div className="panel-header">
            <div className="panel-headline">
              <nav className="app-switcher" aria-label="Apps">
                <a href="/seiten-check">Seiten-Check</a>
                <a href="/scriptverwaltung" className="current" aria-current="page">Scriptverwaltung</a>
              </nav>
              <button className="btn btn-orange" type="button" onClick={() => setDraft({ ...EMPTY, id: `custom_${crypto.randomUUID()}`, implementedAt: new Date().toISOString().slice(0, 10) })}>+ Neues Script</button>
            </div>
            <div className="tabstrip" role="tablist">
              <button className="tab" type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}>Alle Scripts <span className="tab-count">{scripts?.length ?? 0}</span></button>
              <button className="tab" type="button" role="tab" aria-selected={view === "order"} onClick={() => setView("order")}>Lade-Reihenfolge</button>
            </div>
          </div>
          {view === "table" ? (
            <TableToolsMenu tableId="scriptverwaltung-scripts" appName="Scriptverwaltung" tableName="Scripts" columns={COLUMNS} rows={visible} filters={filters}>
              {(tools) => (
                <section>
                  <div className="toolbar">
                    <label className="searchbox"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Volltextsuche" placeholder="Scripts, Zweck oder Notizen suchen ..." /></label>
                    <div className="toolbar-right">
                      <div className="segmented" role="group">{(["all", "active", "inactive"] as const).map((item) => <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{{ all: "Alle", active: "Aktiv", inactive: "Inaktiv" }[item]}</button>)}</div>
                      {tools.menu}
                    </div>
                  </div>
                  <div className="sv-width-help">Spalten am rechten Rand ziehen · Doppelklick setzt die Breite zurück.</div>
                  <div className="table-scroll">
                    <table aria-label="Scriptkonfiguration">
                      <thead><tr>
                        {COLUMNS.filter((column) => tools.isVisible(column.id)).map((column) => (
                          <th key={column.id} className={sort === column.id ? "sortable sorted" : "sortable"} style={{ width: widths.widths[column.id] }}>
                            <button type="button" className="sort-header" onClick={() => toggleSort(column.id)}>{column.label} <span className="sort-arrow">{sort === column.id ? (dir === "asc" ? "↑" : "↓") : "↕"}</span></button>
                            <span className="sv-resize-grip" role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Spaltenbreite ${column.label}`} title="Ziehen: Breite ändern · Doppelklick: zurücksetzen" onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              event.preventDefault();
                              event.stopPropagation();
                              const startX = event.clientX;
                              const start = widths.widths[column.id] ?? WIDTHS[column.id] ?? 140;
                              document.documentElement.classList.add("sv-col-resizing");
                              const move = (ev: PointerEvent) => widths.setWidth(column.id, start + ev.clientX - startX);
                              const up = () => {
                                document.documentElement.classList.remove("sv-col-resizing");
                                window.removeEventListener("pointermove", move);
                                window.removeEventListener("pointerup", up);
                              };
                              window.addEventListener("pointermove", move);
                              window.addEventListener("pointerup", up);
                            }} onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); widths.resetWidth(column.id); }} onKeyDown={(event) => { if (event.key === "ArrowRight") widths.setWidth(column.id, (widths.widths[column.id] ?? 140) + 20); if (event.key === "ArrowLeft") widths.setWidth(column.id, (widths.widths[column.id] ?? 140) - 20); }} onClick={(event) => event.stopPropagation()} />
                          </th>
                        ))}
                        <th style={{ width: 84, minWidth: 84 }}>Aktionen</th>
                      </tr></thead>
                      <tbody>
                        {visible.map((script) => (
                          <tr key={script.id}>
                            {tools.isVisible("name") && <td><div className="script-name"><div className={`script-avatar ${script.type}`} /><div className="name-stack"><strong>{script.name}</strong><span>{script.required ? "System / obligatorisch" : "Integration"}</span></div></div></td>}
                            {tools.isVisible("details") && <TipCell className="truncate" tip={script.details}>{script.details}</TipCell>}
                            {tools.isVisible("source") && <TipCell tip={script.websiteUrl || script.sourceText || "Keine Quelle"}>{script.websiteUrl ? <a className="website" href={script.websiteUrl} target="_blank" rel="noreferrer">{safeHost(script.websiteUrl)}</a> : <span className="source-only">{script.sourceText || "Keine Quelle"}</span>}</TipCell>}
                            {tools.isVisible("implementedAt") && <TipCell tip={formatDeDate(script.implementedAt)}>{formatDeDate(script.implementedAt)}</TipCell>}
                            {tools.isVisible("reason") && <TipCell className="truncate" tip={script.reason}>{script.reason}</TipCell>}
                            {tools.isVisible("note") && <TipCell className="truncate" tip={script.note}>{script.note}</TipCell>}
                            {tools.isVisible("category") && <TipCell tip={script.category}><span className={`chip ${chipClass(script.category)}`}>{script.category}</span></TipCell>}
                            {tools.isVisible("active") && <td><label className="switch"><input type="checkbox" checked={script.active} disabled={script.required} aria-label={`${script.name} global`} onChange={(event) => scripts && persist(scripts.map((item) => item.id === script.id ? { ...item, active: event.target.checked } : item), "Globaler Status gespeichert.").catch((reason: Error) => ping(reason.message))} /><span className="switch-track" /></label> <span className={`switch-label ${script.active ? "on" : ""}`}>{script.active ? "Aktiv" : "Inaktiv"}</span></td>}
                            {tools.isVisible("order") && <td><span className="order-nr">{String(script.order).padStart(2, "0")}</span></td>}
                            <td style={{ width: 84, minWidth: 84 }}><div className="action-buttons"><button type="button" className="icon-btn" aria-label={`${script.name} bearbeiten`} onClick={() => setDraft(script)}><PencilSimple size={16} weight="bold" aria-hidden /></button><button type="button" className="icon-btn danger" aria-label={`${script.name} entfernen`} disabled={script.required} onClick={() => setRemoveId(script.id)}><Trash size={16} weight="bold" aria-hidden /></button></div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {visible.length === 0 ? <div className="empty"><h3>Keine Scripts gefunden</h3><p>Suche oder Statusfilter anpassen.</p></div> : null}
                </section>
              )}
            </TableToolsMenu>
          ) : (
            <section className="order-panel" style={{ display: "block" }}>
              <div className="order-title"><div><h2>Lade-Reihenfolge verwalten</h2><p className="micro">Termly bleibt als Consent-Grundlage an erster Position. Die Website muss in dieser Reihenfolge und erst nach der passenden Einwilligung laden.</p></div></div>
              <div className="order-list">
                {(scripts ?? []).map((script, index) => (
                  <div key={script.id} className={`order-item ${dragId === script.id ? "dragging" : ""}`} draggable={!script.required} onDragStart={() => setDragId(script.id)} onDragOver={(event) => { if (script.required || !dragId) return; event.preventDefault(); }} onDrop={() => { if (!dragId || !scripts) return; const from = scripts.findIndex((item) => item.id === dragId); const to = index; setDragId(null); if (from <= 0 || to <= 0) return; persist(moveScript(scripts, dragId, to), "Lade-Reihenfolge gespeichert.").catch((reason: Error) => ping(reason.message)); }}>
                    <span className="order-index">{String(script.order).padStart(2, "0")}</span>
                    <span className="order-label"><strong>{script.name}</strong><small>{script.category} · {script.active ? "Global aktiv" : "Global inaktiv"}</small></span>
                    {script.required ? <span className="locked-flag">Fixiert</span> : (
                      <span className="order-controls">
                        <button type="button" className="icon-btn" disabled={index <= 1} aria-label="nach oben" onClick={() => scripts && persist(moveScript(scripts, script.id, index - 1), "Lade-Reihenfolge gespeichert.")}><CaretUp size={16} weight="bold" aria-hidden /></button>
                        <button type="button" className="icon-btn" disabled={index === scripts!.length - 1} aria-label="nach unten" onClick={() => scripts && persist(moveScript(scripts, script.id, index + 1), "Lade-Reihenfolge gespeichert.")}><CaretDown size={16} weight="bold" aria-hidden /></button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
        <aside className="rulebox"><div><strong>Globale Regel vor Seitenregel</strong><p>Ein global deaktiviertes Script wird nirgends ausgeführt. Ist es global aktiv, gelten die Seitenschalter in <code>seitenkonfiguration</code> und die Termly-Kategorie. Diese App führt keine Tracking-Scripts aus.</p></div></aside>
        {mode === "mock" ? <button className="footer-link" type="button" onClick={() => clientApi("/api/reset", { method: "POST" }).then(() => load()).then(() => ping("Beispieldaten zurückgesetzt."))}>Beispieldaten zurücksetzen</button> : null}
      </div>
      {draft ? <Editor draft={draft} setDraft={setDraft} existing={scripts?.some((script) => script.id === draft.id && script.name) ? scripts.find((script) => script.id === draft.id) : undefined} onClose={() => setDraft(null)} onSave={() => {
        const problem = validateScriptDraft(draft, draft.id === TERMLY_ID ? draft : undefined);
        if (problem) { ping(problem); return; }
        const base = scripts ?? [];
        const next = base.some((script) => script.id === draft.id) ? upsertScript(base, draft) : upsertScript(base, draft);
        persist(next, "Script gespeichert.").then(() => setDraft(null)).catch((reason: Error) => ping(reason.message));
      }} onDelete={() => { setRemoveId(draft.id); }} /> : null}
      {removing ? (
        <ConfirmDialog
          title="Script entfernen?"
          body={`„${removing.name}“ aus der zentralen Konfiguration entfernen? Der Seitenschalter bleibt in den Stories liegen, wird aber nicht mehr geladen.`}
          confirmLabel="Script entfernen"
          onCancel={() => setRemoveId(null)}
          onConfirm={() => scripts && persist(scripts.filter((script) => script.id !== removing.id || script.required), "Script entfernt.").then(() => { setRemoveId(null); setDraft(null); })}
        />
      ) : null}
      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}

/** Native Dialog mit showModal, damit Backdrop und Overlay sichtbar sind. */
function useModalDialog(onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (!node.open) node.showModal();
    const onCancel = (event: Event) => {
      event.preventDefault();
      onCloseRef.current();
    };
    node.addEventListener("cancel", onCancel);
    return () => {
      node.removeEventListener("cancel", onCancel);
      if (node.open) node.close();
    };
  }, []);
  return ref;
}

function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm }: { title: string; body: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }) {
  const ref = useModalDialog(onCancel);
  return (
    <dialog ref={ref} className="confirm">
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="confirm-actions">
        <button className="btn btn-plain" type="button" onClick={onCancel}>Abbrechen</button>
        <button className="btn btn-danger" type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}

function safeHost(value: string): string {
  try { return new URL(value).host.replace(/^www\./, ""); } catch { return value; }
}

/** Tabellenzelle mit sofort sichtbarem Hover-Tipp für gekürzte Inhalte. */
function TipCell({ tip, className, children }: { tip: string; className?: string; children: ReactNode }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const text = tip.trim();
  if (!text) return <td className={className}>{children}</td>;
  return (
    <td
      className={className}
      onMouseEnter={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        const width = Math.min(360, window.innerWidth - 24);
        setPos({ x: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)), y: box.bottom + 8 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos ? <span className="sv-cell-tip" role="tooltip" style={{ left: pos.x, top: pos.y }}>{text}</span> : null}
    </td>
  );
}

function chipClass(category: CookieCategory): string {
  return { Notwendig: "necessary", Analytik: "analytics", Marketing: "marketing", Funktional: "functional" }[category];
}

function Editor({ draft, setDraft, existing, onClose, onSave, onDelete }: { draft: ScriptRecord; setDraft: (script: ScriptRecord) => void; existing?: ScriptRecord; onClose: () => void; onSave: () => void; onDelete: () => void }) {
  const locked = existing?.required || draft.id === TERMLY_ID && Boolean(existing);
  const ref = useModalDialog(onClose);
  return (
    <dialog ref={ref} className="drawer" aria-label="Script">
      <div className="drawer-head"><div><h2>{existing ? "Script bearbeiten" : "Neues Script"}</h2><p>{existing ? `${existing.name} / Globale Konfiguration` : "Integration zur zentralen Konfiguration hinzufügen"}</p></div><button className="icon-btn" type="button" aria-label="Schließen" onClick={onClose}><X size={16} weight="bold" aria-hidden /></button></div>
      <div className="drawer-body">
        <div className="form-grid">
          <label className="field">Scriptname *<input value={draft.name} readOnly={locked} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="field">Cookie-Kategorie *<select value={draft.category} disabled={locked} onChange={(event) => setDraft({ ...draft, category: event.target.value as CookieCategory })}>{COOKIE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field full">Details *<textarea value={draft.details} onChange={(event) => setDraft({ ...draft, details: event.target.value })} /></label>
          <label className="field">Link zur Website<input value={draft.websiteUrl} onChange={(event) => setDraft({ ...draft, websiteUrl: event.target.value })} placeholder="https://" /></label>
          <label className="field">Quelle ohne Website<input value={draft.sourceText} onChange={(event) => setDraft({ ...draft, sourceText: event.target.value })} /></label>
          <label className="field">Implementiert am<input type="date" value={draft.implementedAt} onChange={(event) => setDraft({ ...draft, implementedAt: event.target.value })} /></label>
          <label className="field">Einordnung<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value as ScriptType })}>{SCRIPT_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="field full">Implementierungsgrund *<textarea value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} /></label>
          <label className="field full">Notiz *<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          <label className="field full">Snippet / Integrationscode<textarea className="code-area sv-snippet" spellCheck={false} value={draft.snippet} onChange={(event) => setDraft({ ...draft, snippet: event.target.value })} /><span className="hint">Das Snippet wird nur als Text gespeichert und in dieser App nicht ausgeführt.</span></label>
          <div className="toggle-line"><div><strong>Global aktiviert</strong></div><label className="switch"><input type="checkbox" checked={draft.active} disabled={locked} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /><span className="switch-track" /></label></div>
        </div>
      </div>
      <div className="drawer-foot">
        {existing && !locked ? <button type="button" className="btn btn-danger" onClick={onDelete}>Entfernen</button> : <span />}
        <button type="button" className="btn btn-plain" onClick={onClose}>Abbrechen</button>
        <button type="button" className="btn btn-primary" onClick={onSave}>Speichern</button>
      </div>
    </dialog>
  );
}
