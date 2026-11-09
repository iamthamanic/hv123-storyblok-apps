"use client";

/**
 * Seiten-Check: sortierbare Übersicht aller Stories, Inline-Bearbeitung und Linkprüfung.
 * Ort: /components/seiten-check/SeitenCheckApp.tsx
 */

import { useEffect, useMemo, useState } from "react";
import { TableToolsMenu, type TableColumn } from "@/components/table/TableToolsMenu";
import { useColumnWidths } from "@/components/table/useColumnWidths";
import { clientApi, formatDeDate } from "@/components/shared/client-api";
import type { PagePatch, PageRecord } from "@/lib/types";

const WIDTHS: Record<string, number> = {
  name: 220, domain: 200, realPath: 240, index: 110, follow: 110, canonical: 200,
  redirect: 120, redirectUrl: 220, sitemap: 100, redirectDate: 130, note: 180, broken: 120, updated: 120,
};
const LINK_WIDTHS: Record<string, number> = {
  name: 220, realPath: 240, outgoing: 110, internal: 130, incoming: 140, external: 140, backlinks: 140, broken: 120,
};

const PAGE_COLUMNS: TableColumn<PageRecord>[] = [
  { id: "name", label: "Seitenname", value: (page) => page.name },
  { id: "domain", label: "Domain", value: (page) => page.domain },
  { id: "realPath", label: "Real Path", value: (page) => page.realPath },
  { id: "index", label: "Index", value: (page) => (page.index ? "Index" : "Noindex") },
  { id: "follow", label: "Follow", value: (page) => (page.follow ? "Follow" : "Nofollow") },
  { id: "canonical", label: "Canonical", value: (page) => page.canonical },
  { id: "redirect", label: "Redirect 301", value: (page) => (page.redirectUrl ? "ja" : "nein") },
  { id: "redirectUrl", label: "Redirect-URL", value: (page) => page.redirectUrl },
  { id: "redirectDate", label: "Redirect-Datum", value: (page) => page.redirectDate },
  { id: "note", label: "Notiz", value: (page) => page.note },
  { id: "sitemap", label: "Sitemap", value: (page) => (page.sitemap ? "ja" : "nein") },
  { id: "broken", label: "Broken Links", value: (page) => page.broken.length },
  { id: "updated", label: "Geändert", value: (page) => page.updatedAt },
];

const LINK_COLUMNS: TableColumn<PageRecord>[] = [
  { id: "name", label: "Seitenname", value: (page) => page.name },
  { id: "realPath", label: "Real Path", value: (page) => page.realPath },
  { id: "outgoing", label: "Ausgehend", value: (page) => page.outgoing.length },
  { id: "internal", label: "Intern ausgehend", value: (page) => page.outgoing.filter((link) => link.kind === "internal").length },
  { id: "incoming", label: "Intern eingehend", value: (page) => page.incoming.length },
  { id: "external", label: "Extern ausgehend", value: (page) => page.outgoing.filter((link) => link.kind === "external").length },
  { id: "backlinks", label: "Extern eingehend", value: () => "Nicht erfasst" },
  { id: "broken", label: "Linkfehler", value: (page) => page.broken.length },
];

type View = "all" | "redirects" | "broken" | "links";
type Filter = "all" | "redirect" | "broken" | "noindex" | "pathless";
type Edit = { id: string; field: "realPath" | "redirectUrl" | "canonical" | "note" } | null;

export function SeitenCheckApp() {
  const [pages, setPages] = useState<PageRecord[] | null>(null);
  const [mode, setMode] = useState("mock");
  const [error, setError] = useState("");
  const [auth, setAuth] = useState(false);
  const [view, setView] = useState<View>("all");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [wrap, setWrap] = useState(false);
  const [editing, setEditing] = useState<Edit>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [tab, setTab] = useState<"path" | "seo" | "broken" | "links">("path");
  const [draft, setDraft] = useState<PagePatch | null>(null);
  const [modal, setModal] = useState(false);
  const [brokenId, setBrokenId] = useState<string | null>(null);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState("");
  const [toast, setToast] = useState("");
  const widths = useColumnWidths("hv-widths-seiten", WIDTHS);
  const linkWidths = useColumnWidths("hv-widths-links", LINK_WIDTHS);

  async function load() {
    const meta = await clientApi<{ mode: string }>("/api/meta");
    setMode(meta.mode);
    const data = await clientApi<{ pages: PageRecord[]; mode: string }>("/api/pages");
    setPages(data.pages);
    setMode(data.mode);
    setAuth(false);
    setError("");
  }

  useEffect(() => {
    load().catch((reason: Error & { code?: string }) => {
      setAuth(reason.code === "auth");
      setError(reason.message);
      setPages([]);
    });
  }, []);

  function ping(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function save(id: string, patch: PagePatch) {
    try {
      await clientApi(`/api/pages/${id}`, { method: "PUT", body: JSON.stringify({ patch }) });
      await load();
      ping(mode === "mock" ? "Im Mock gespeichert." : "In Storyblok gespeichert.");
    } catch (reason) {
      ping(reason instanceof Error ? reason.message : "Speichern fehlgeschlagen.");
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("de");
    const list = (pages ?? []).filter((page) => {
      if (view === "redirects" && !page.redirectUrl) return false;
      if (view === "broken" && page.broken.length === 0) return false;
      if (filter === "redirect" && !page.redirectUrl) return false;
      if (filter === "broken" && page.broken.length === 0) return false;
      if (filter === "noindex" && page.index) return false;
      if (filter === "pathless" && page.realPath) return false;
      if (!query) return true;
      return [page.name, page.realPath, page.domain, page.redirectUrl, page.note, page.canonical].join(" ").toLocaleLowerCase("de").includes(query);
    });
    const value = (page: PageRecord) => {
      if (sort === "broken") return page.broken.length;
      if (sort === "outgoing") return page.outgoing.length;
      if (sort === "incoming") return page.incoming.length;
      if (sort === "internal") return page.outgoing.filter((link) => link.kind === "internal").length;
      if (sort === "external") return page.outgoing.filter((link) => link.kind === "external").length;
      if (sort === "redirect") return page.redirectUrl ? 1 : 0;
      if (sort === "index") return page.index ? 1 : 0;
      if (sort === "sitemap") return page.sitemap ? 1 : 0;
      return String((page as Record<string, unknown>)[sort] ?? "");
    };
    return list.sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "de", { numeric: true });
      return result * (dir === "asc" ? 1 : -1);
    });
  }, [pages, view, filter, search, sort, dir]);

  function toggleSort(key: string) {
    setDir(sort === key && dir === "asc" ? "desc" : "asc");
    setSort(key);
  }

  const drawer = pages?.find((page) => page.id === drawerId) ?? null;
  const brokenPage = pages?.find((page) => page.id === brokenId) ?? null;
  const viewName = view === "links" ? "Link Check" : view === "redirects" ? "Weiterleitungen" : view === "broken" ? "Linkfehler" : "Alle Seiten";
  const filterName = { all: "Alle", redirect: "Mit Redirect", broken: "Mit Linkfehlern", noindex: "Noindex", pathless: "Ohne Real Path" }[filter];
  const activeFilters = [
    { label: "Ansicht", value: viewName },
    { label: "Filter", value: filterName },
    ...(search.trim() ? [{ label: "Suche", value: search.trim() }] : []),
  ];

  function openDrawer(page: PageRecord, nextTab: typeof tab = "path") {
    setDrawerId(page.id);
    setTab(nextTab);
    setDraft({
      realPath: page.realPath,
      redirectUrl: page.redirectUrl,
      note: page.note,
      canonical: page.canonical,
      index: page.index,
      follow: page.follow,
      sitemap: page.sitemap,
      domain: page.domain,
      seoTitle: page.seoTitle,
      tracking: Object.fromEntries(page.tracking.map((item) => [item.id, item.enabled])),
    });
  }

  return (
    <div className={`seitencheck-app${wrap ? " sc-resizing-off" : ""}`}>
      <div className="sc-shell">
        <header className="sc-topbar">
          <div className="sc-brandbar">
            <span className="sc-topmark">b<span>.</span></span>
            <span className="sc-topbrand">Website-Tools</span>
            <span className="sc-crumb-divider">/</span>
            <span className="sc-topcurrent">Seitencheck</span>
          </div>
          <nav className="sc-app-nav" aria-label="Apps">
            <a className="sc-app-item current" href="/seiten-check" aria-current="page">Seiten-Check</a>
            <a className="sc-app-item" href="/scriptverwaltung">Scriptverwaltung</a>
          </nav>
          <span className="sc-demo"><span className="sc-dot" />{mode === "mock" ? "MOCK-MODUS" : mode === "pat" ? "PAT-MODUS" : "OAUTH"}</span>
        </header>
        <main className="sc-workspace">
          <div className="sc-title-row">
            <div>
              <div className="sc-kicker">CONTENT OPERATIONS <span className="sc-kicker-divider">/</span> SEO & QUALITÄTSSICHERUNG</div>
              <h1 className="sc-h1">Seitencheck<span className="sc-accent-dot">.</span></h1>
              <p className="sc-sub">URLs, Weiterleitungen und Seitenqualität zentral verwalten. Snippets werden hier nicht ausgeführt.</p>
            </div>
            <div className="sc-title-actions">
              <button type="button" className="sc-btn sc-btn-primary" onClick={() => { setModal(true); setFormError(""); }}>+ Redirect erstellen</button>
            </div>
          </div>
          {error ? <p className="sc-error" role="alert">{error} {auth ? (
              // OAuth startet einen Redirect über die Pages-API, deshalb kein Client-Link.
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/api/connect/seiten-check/storyblok">Mit Storyblok verbinden</a>
            ) : <button type="button" className="sc-link" onClick={() => load().catch(() => undefined)}>Erneut laden</button>}</p> : null}
          <div className="sc-info-strip">
            <button type="button" className="sc-info-item" onClick={() => { setView("all"); setFilter("all"); }}><strong>{pages?.length ?? "…"}</strong><span>Seiten</span></button>
            <button type="button" className="sc-info-item" onClick={() => setView("redirects")}><strong>{pages?.filter((page) => page.redirectUrl).length ?? 0}</strong><span>301-Redirects</span></button>
            <button type="button" className="sc-info-item warn" onClick={() => setView("broken")}><strong>{pages?.reduce((sum, page) => sum + page.broken.length, 0) ?? 0}</strong><span>Linkfehler</span></button>
            <button type="button" className="sc-info-item" onClick={() => { setView("all"); setFilter("pathless"); }}><strong>{pages?.filter((page) => !page.realPath).length ?? 0}</strong><span>Ohne Real Path</span></button>
          </div>
          <section className="sc-table-card">
            <div className="sc-viewnav">
              {(["all", "redirects", "broken", "links"] as View[]).map((item) => (
                <button key={item} type="button" className={`sc-viewtab ${view === item ? "active" : ""}`} onClick={() => { setView(item); setFilter("all"); }}>
                  <span>{{ all: "Alle Seiten", redirects: "Weiterleitungen", broken: "Linkfehler", links: "Link Check" }[item]}</span>
                </button>
              ))}
            </div>
            {view === "links" ? (
              <TableToolsMenu tableId="seitencheck-links" appName="Seiten-Check" tableName="Link Check" columns={LINK_COLUMNS} rows={filtered} filters={activeFilters}>
                {(tools) => (
                  <>
                    <Toolbar search={search} setSearch={setSearch} wrap={wrap} setWrap={setWrap} onCheck={() => clientApi<{ pages: PageRecord[] }>("/api/pages/check-links", { method: "POST" }).then((data) => { setPages(data.pages); ping(mode === "mock" ? "Linkprüfung aus den Beispieldaten." : "Linkprüfung abgeschlossen."); }).catch((reason: Error) => ping(reason.message))} menu={tools.menu} />
                    <FilterLine filter={filter} setFilter={setFilter} links />
                    <div className={`sc-table-viewport sc-link-table ${wrap ? "sc-wrap-text" : ""}`}>
                      <table className="sc-table">
                        <thead><tr>
                          {LINK_COLUMNS.filter((column) => tools.isVisible(column.id)).map((column) => (
                            <Th key={column.id} label={column.label} sortKey={column.id} sort={sort} dir={dir} onSort={toggleSort} width={linkWidths.widths[column.id] ?? 140} onWidth={(width) => linkWidths.setWidth(column.id, width)} onReset={() => linkWidths.resetWidth(column.id)} />
                          ))}
                        </tr></thead>
                        <tbody>
                          {filtered.map((page) => (
                            <tr key={page.id}>
                              {tools.isVisible("name") && <td><button type="button" className="sc-link-page" onClick={() => openDrawer(page, "links")}>{page.name}</button></td>}
                              {tools.isVisible("realPath") && <td>{page.realPath ? <span className="sc-code">{page.realPath}</span> : <span className="sc-blank">Kein Pfad</span>}</td>}
                              {tools.isVisible("outgoing") && <td><span className="sc-link-count primary">{page.outgoing.length}</span></td>}
                              {tools.isVisible("internal") && <td><span className="sc-link-count">{page.outgoing.filter((link) => link.kind === "internal").length}</span></td>}
                              {tools.isVisible("incoming") && <td><span className="sc-link-count">{page.incoming.length}</span></td>}
                              {tools.isVisible("external") && <td><span className="sc-link-count">{page.outgoing.filter((link) => link.kind === "external").length}</span></td>}
                              {tools.isVisible("backlinks") && <td><span className="sc-canonical-auto">Nicht erfasst</span></td>}
                              {tools.isVisible("broken") && <td>{page.broken.length ? <button type="button" className="sc-badge warn" onClick={() => setBrokenId(page.id)}>{page.broken.length} fehlerhaft</button> : <span className="sc-badge good">Keine</span>}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="sc-links-explain">Externe eingehende Backlinks lassen sich nicht aus den Stories lesen und werden nicht erfasst.</p>
                  </>
                )}
              </TableToolsMenu>
            ) : (
              <TableToolsMenu tableId="seitencheck-seiten" appName="Seiten-Check" tableName={viewName} columns={PAGE_COLUMNS} rows={filtered} filters={activeFilters}>
                {(tools) => (
                  <>
                    <Toolbar search={search} setSearch={setSearch} wrap={wrap} setWrap={setWrap} onCheck={() => clientApi<{ pages: PageRecord[] }>("/api/pages/check-links", { method: "POST" }).then((data) => { setPages(data.pages); ping("Linkprüfung abgeschlossen."); }).catch((reason: Error) => ping(reason.message))} menu={tools.menu} />
                    <FilterLine filter={filter} setFilter={setFilter} />
                    <div className={`sc-table-viewport ${wrap ? "sc-wrap-text" : ""}`}>
                      <table className="sc-table">
                        <thead><tr>
                          {PAGE_COLUMNS.filter((column) => tools.isVisible(column.id)).map((column) => (
                            <Th key={column.id} label={column.label} sortKey={column.id} sort={sort} dir={dir} onSort={toggleSort} width={widths.widths[column.id] ?? 140} onWidth={(width) => widths.setWidth(column.id, width)} onReset={() => widths.resetWidth(column.id)} />
                          ))}
                          <th />
                        </tr></thead>
                        <tbody>
                          {filtered.length === 0 ? <tr><td colSpan={12}><div className="sc-empty"><b>{pages ? "Keine passenden Seiten" : "Seiten werden geladen"}</b>{pages ? "Suche oder Filter ändern." : ""}</div></td></tr> : null}
                          {filtered.map((page) => (
                            <tr key={page.id}>
                              {tools.isVisible("name") && <td><button type="button" className="sc-row-name" onClick={() => openDrawer(page)}>{page.name}</button>{page.kind === "redirect" ? <span className="sc-row-secondary">Manuelle Weiterleitung</span> : null}</td>}
                              {tools.isVisible("domain") && <td><span className="sc-code">{page.domain}</span></td>}
                              {tools.isVisible("realPath") && <td><Cell page={page} field="realPath" editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("index") && <td><button type="button" className={`sc-robots-pill sc-pill-btn ${page.index ? "positive" : "caution"}`} onClick={() => save(page.id, { index: !page.index })}>{page.index ? "Index" : "Noindex"}</button></td>}
                              {tools.isVisible("follow") && <td><button type="button" className={`sc-robots-pill sc-pill-btn ${page.follow ? "positive" : "caution"}`} onClick={() => save(page.id, { follow: !page.follow })}>{page.follow ? "Follow" : "Nofollow"}</button></td>}
                              {tools.isVisible("canonical") && <td><Cell page={page} field="canonical" editing={editing} setEditing={setEditing} save={save} placeholder="Automatisch / nicht gesetzt" /></td>}
                              {tools.isVisible("redirect") && <td>{page.redirectUrl ? <span className="sc-status is-active"><span className="sc-status-dot" />Ja · 301</span> : <span className="sc-status is-inactive"><span className="sc-status-dot" />Nein</span>}</td>}
                              {tools.isVisible("redirectUrl") && <td><Cell page={page} field="redirectUrl" editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("redirectDate") && <td><span className="sc-tiny">{formatDeDate(page.redirectDate)}</span></td>}
                              {tools.isVisible("note") && <td><Cell page={page} field="note" editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("sitemap") && <td><button type="button" className={`sc-badge ${page.sitemap ? "good" : "neutral"}`} onClick={() => save(page.id, { sitemap: !page.sitemap })}>{page.sitemap ? "Ja" : "Nein"}</button></td>}
                              {tools.isVisible("broken") && <td>{page.broken.length ? <button type="button" className="sc-errors" onClick={() => setBrokenId(page.id)}>{page.broken.length} Fehler</button> : <span className="sc-errors is-clear">Keine</span>}</td>}
                              {tools.isVisible("updated") && <td><span className="sc-tiny">{formatDeDate(page.updatedAt)}</span></td>}
                              <td><button type="button" className="sc-edit-button" aria-label={`${page.name} bearbeiten`} onClick={() => openDrawer(page)}>✎</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </TableToolsMenu>
            )}
            <div className="sc-table-footer"><span>{filtered.length} von {pages?.length ?? 0} Seiten</span><span>Real Path bleibt leer, solange keiner gesetzt ist.</span></div>
          </section>
          {mode === "mock" ? <div className="sc-footbar"><button type="button" className="sc-link" onClick={() => clientApi("/api/reset", { method: "POST" }).then(() => load()).then(() => ping("Beispieldaten zurückgesetzt."))}>Beispieldaten zurücksetzen</button><span>Feld seitenkonfiguration · hv-seitenkonfiguration</span></div> : null}
        </main>
      </div>
      {drawer && draft ? (
        <div className="sc-dimmer" onClick={() => setDrawerId(null)}>
          <aside className="sc-drawer" role="dialog" aria-label="Seitenkonfiguration" onClick={(event) => event.stopPropagation()}>
            <div className="sc-drawer-head">
              <div className="sc-drawer-top">
                <div>
                  <div className="sc-smallcaps">SEITENKONFIGURATION</div>
                  <h2>{drawer.name}</h2>
                  <div className="sc-drawer-path">{drawer.realPath || "Kein Real Path hinterlegt"}</div>
                </div>
                <button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={() => setDrawerId(null)}>×</button>
              </div>
              <div className="sc-tabs">
                {([["path", "URL & Redirect"], ["seo", "SEO & Tracking"], ["broken", `Linkfehler (${drawer.broken.length})`], ["links", "Link Check"]] as const).map(([key, label]) => (
                  <button key={key} type="button" className={`sc-tab ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
                ))}
              </div>
            </div>
            <div className="sc-drawer-scroll">
              {tab === "path" ? (
                <>
                  <label className="sc-field">Real Path<input className="sc-input" value={draft.realPath ?? ""} onChange={(event) => setDraft({ ...draft, realPath: event.target.value })} /></label>
                  <label className="sc-field">Ziel-URL für 301-Redirect<input className="sc-input" value={draft.redirectUrl ?? ""} onChange={(event) => setDraft({ ...draft, redirectUrl: event.target.value })} /></label>
                  <label className="sc-field">Interne Notiz<textarea className="sc-textarea" value={draft.note ?? ""} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
                </>
              ) : null}
              {tab === "seo" ? (
                <>
                  <div className="sc-control-row"><b>Indexierung</b><div className="sc-segment"><button type="button" className={draft.index ? "active" : ""} onClick={() => setDraft({ ...draft, index: true })}>Index</button><button type="button" className={!draft.index ? "active" : ""} onClick={() => setDraft({ ...draft, index: false })}>Noindex</button></div></div>
                  <div className="sc-control-row"><b>Link-Crawling</b><div className="sc-segment"><button type="button" className={draft.follow ? "active" : ""} onClick={() => setDraft({ ...draft, follow: true })}>Follow</button><button type="button" className={!draft.follow ? "active" : ""} onClick={() => setDraft({ ...draft, follow: false })}>Nofollow</button></div></div>
                  <div className="sc-switch-row"><div><b>In Sitemap aufnehmen</b></div><button type="button" className={`sc-switch ${draft.sitemap ? "on" : ""}`} aria-pressed={draft.sitemap} onClick={() => setDraft({ ...draft, sitemap: !draft.sitemap })}><span /></button></div>
                  <label className="sc-field">Canonical Tag<input className="sc-input" value={draft.canonical ?? ""} onChange={(event) => setDraft({ ...draft, canonical: event.target.value })} /></label>
                  {drawer.hasSeoTitleField ? <p className="sc-help">SEO-Titel (Feld seo_title): {drawer.seoTitle || "—"}</p> : <p className="sc-help">Diese Komponente hat kein Feld seo_title.</p>}
                  <h3 className="sc-section-label">Tracking auf dieser Seite</h3>
                  {drawer.tracking.map((item) => (
                    <div key={item.id} className="sc-switch-row">
                      <div><b>{item.name}</b><small>{item.category}. Lädt nur, wenn das Script global aktiv ist und Termly zustimmt.</small></div>
                      <button type="button" className={`sc-switch ${draft.tracking?.[item.id] ? "on" : ""}`} onClick={() => setDraft({ ...draft, tracking: { ...draft.tracking, [item.id]: !draft.tracking?.[item.id] } })}><span /></button>
                    </div>
                  ))}
                </>
              ) : null}
              {tab === "broken" ? <BrokenList page={drawer} /> : null}
              {tab === "links" ? <LinkList page={drawer} onOpen={(id) => { const found = pages?.find((item) => item.id === id); if (found) openDrawer(found, "links"); }} /> : null}
            </div>
            <div className="sc-drawer-foot">
              <small>{drawer.component ?? "manuell"} · {formatDeDate(drawer.updatedAt)}</small>
              <button type="button" className="sc-btn sc-btn-primary" onClick={() => save(drawer.id, draft).then(() => setDrawerId(null))}>Änderungen speichern</button>
            </div>
          </aside>
        </div>
      ) : null}
      {brokenPage ? (
        <div className="sc-modal-wrap" role="dialog" aria-modal="true" aria-label="Defekte Links">
          <div className="sc-modal-backdrop" onClick={() => setBrokenId(null)} />
          <div className="sc-modal sc-broken-modal">
            <div className="sc-modal-head"><div><div className="sc-smallcaps">LINKFEHLER</div><h2>{brokenPage.name}</h2></div><button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={() => setBrokenId(null)}>×</button></div>
            <BrokenList page={brokenPage} />
          </div>
        </div>
      ) : null}
      {modal ? (
        <div className="sc-modal-wrap" role="dialog" aria-modal="true" aria-label="Redirect erstellen">
          <div className="sc-modal-backdrop" onClick={() => setModal(false)} />
          <form className="sc-modal" onSubmit={(event) => { event.preventDefault(); clientApi<{ page: PageRecord }>("/api/pages/redirects", { method: "POST", body: JSON.stringify({ source, target, note }) }).then(() => { setModal(false); setSource(""); setTarget(""); setNote(""); return load(); }).then(() => ping("301-Redirect gespeichert.")).catch((reason: Error) => setFormError(reason.message)); }}>
            <div className="sc-modal-head"><div><div className="sc-smallcaps">WEITERLEITUNGEN</div><h2>301-Redirect erstellen</h2></div><button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={() => setModal(false)}>×</button></div>
            <label className="sc-field">Alte URL (Quelle)<input className="sc-input" required value={source} onChange={(event) => setSource(event.target.value)} placeholder="/alte-seite.html" /></label>
            <label className="sc-field">Neue URL (Ziel)<input className="sc-input" required value={target} onChange={(event) => setTarget(event.target.value)} placeholder="/neue-seite/" /></label>
            <label className="sc-field">Interne Notiz<input className="sc-input" value={note} onChange={(event) => setNote(event.target.value)} /></label>
            {formError ? <div className="sc-error" role="alert">{formError}</div> : null}
            <div className="sc-modal-actions"><button type="button" className="sc-btn" onClick={() => setModal(false)}>Abbrechen</button><button type="submit" className="sc-btn sc-btn-primary">301-Redirect speichern</button></div>
          </form>
        </div>
      ) : null}
      {toast ? <div className="sc-toast" role="status">{toast}</div> : null}
    </div>
  );
}

function Toolbar({ search, setSearch, wrap, setWrap, onCheck, menu }: { search: string; setSearch: (value: string) => void; wrap: boolean; setWrap: (value: boolean) => void; onCheck: () => void; menu: React.ReactNode }) {
  return (
    <div className="sc-table-toolbar">
      <div className="sc-toolbar-left"><div className="sc-search"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Seite, Pfad oder Ziel-URL suchen ..." aria-label="Seiten durchsuchen" /></div></div>
      <div className="sc-toolbar-right">
        <button type="button" className="sc-filter-btn" onClick={onCheck}>Links prüfen</button>
        <button type="button" className={`sc-filter-btn ${wrap ? "sc-wrap-active" : ""}`} aria-pressed={wrap} onClick={() => setWrap(!wrap)}>Text umbrechen</button>
        {menu}
      </div>
    </div>
  );
}

function FilterLine({ filter, setFilter, links = false }: { filter: Filter; setFilter: (filter: Filter) => void; links?: boolean }) {
  const items: [Filter, string][] = links ? [["all", "Alle Seiten"], ["broken", "Mit Linkfehlern"], ["noindex", "Noindex"], ["pathless", "Ohne Real Path"]] : [["all", "Alle"], ["redirect", "Mit Redirect"], ["broken", "Mit Linkfehlern"], ["noindex", "Noindex"], ["pathless", "Ohne Real Path"]];
  return <div className="sc-filterline"><span className="sc-filterlabel">FILTER</span>{items.map(([key, label]) => <button key={key} type="button" className={`sc-filterchip ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{label}</button>)}</div>;
}

function Th({ label, sortKey, sort, dir, onSort, width, onWidth, onReset }: { label: string; sortKey: string; sort: string; dir: "asc" | "desc"; onSort: (key: string) => void; width: number; onWidth: (width: number) => void; onReset: () => void }) {
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

function Cell({ page, field, editing, setEditing, save, placeholder = "—" }: { page: PageRecord; field: NonNullable<Edit>["field"]; editing: Edit; setEditing: (edit: Edit) => void; save: (id: string, patch: PagePatch) => Promise<void>; placeholder?: string }) {
  const current = page[field] ?? "";
  if (editing?.id === page.id && editing.field === field) {
    return <input className="sc-inline-input" autoFocus defaultValue={current} aria-label={field} onBlur={(event) => { setEditing(null); if (event.target.value !== current) void save(page.id, { [field]: event.target.value }); }} />;
  }
  return <button type="button" className="sc-code" onClick={() => setEditing({ id: page.id, field })}>{current || placeholder}</button>;
}

function BrokenList({ page }: { page: PageRecord }) {
  if (!page.broken.length) return <div className="sc-emptybroken"><b>Keine defekten Links</b><span>404 und 410 erscheinen hier, sobald die Prüfung sie findet.</span></div>;
  return page.broken.map((link, index) => (
    <div key={`${link.href}-${index}`} className="sc-issue">
      <div className="sc-issuehead"><b>Fehler {index + 1}</b><span className="sc-errorcode">FehlerTyp {link.errorType}</span></div>
      <div className="sc-issuepath">{link.section} <span className="sc-sep">›</span> {link.component} {link.instanceTitle ? <><span className="sc-sep">›</span> {link.instanceTitle}</> : null} <span className="sc-sep">›</span> <b>{link.field}</b></div>
      <div className="sc-issueurl">{link.href}</div>
      <div className="sc-issuefoot">{link.message} · Anker: {link.anchor}</div>
      {page.editorUrl ? <a className="sc-link" href={page.editorUrl} target="_blank" rel="noreferrer">Story in Storyblok öffnen</a> : null}
    </div>
  ));
}

function LinkList({ page, onOpen }: { page: PageRecord; onOpen: (id: string) => void }) {
  return (
    <div className="sc-links-detail">
      <h3>Ausgehende Links ({page.outgoing.length})</h3>
      {page.outgoing.map((link, index) => <article key={`out-${index}`} className="sc-link-entry"><span className={`sc-link-pill ${link.kind === "external" ? "external" : ""}`}>{link.kind === "internal" ? "Intern" : "Extern"}</span> <strong>{link.anchor}</strong><span className="sc-link-url">{link.href}</span><small>Fundstelle: {link.section} · {link.component} · {link.field} · {link.message}</small></article>)}
      <h3>Interne eingehende Links ({page.incoming.length})</h3>
      {page.incoming.length === 0 ? <p className="sc-tiny">Keine andere Story verlinkt hierher.</p> : page.incoming.map((link, index) => <article key={`in-${index}`} className="sc-link-entry"><strong>{link.anchor}</strong><small>Quellseite: {link.sourceName}</small><button type="button" className="sc-text-link" onClick={() => onOpen(link.sourceId)}>Quellseite ansehen</button></article>)}
    </div>
  );
}
