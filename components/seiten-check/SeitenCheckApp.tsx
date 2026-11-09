"use client";

/**
 * Seiten-Check: Orchestrator für Übersicht, Drawer und Link-Details.
 * Ort: /components/seiten-check/SeitenCheckApp.tsx
 */

import { PencilSimple, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { TableToolsMenu } from "@/components/table/TableToolsMenu";
import { useColumnWidths } from "@/components/table/useColumnWidths";
import { clientApi, formatDeDate } from "@/components/shared/client-api";
import { LinkDetailModal } from "@/components/seiten-check/LinkDetailModal";
import { BrokenList, PageDrawer } from "@/components/seiten-check/PageDrawer";
import { CanonicalCell, Cell, FilterLine, LinkCountButton, Th, Toolbar } from "@/components/seiten-check/table-parts";
import { LINK_COLUMNS, LINK_WIDTHS, PAGE_COLUMNS, WIDTHS, type DrawerTab, type Edit, type Filter, type LinkFocus, type View } from "@/components/seiten-check/types";
import type { PagePatch, PageRecord } from "@/lib/types";

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
  const [editing, setEditing] = useState<Edit>(null);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [tab, setTab] = useState<DrawerTab>("path");
  const [draft, setDraft] = useState<PagePatch | null>(null);
  const [brokenId, setBrokenId] = useState<string | null>(null);
  const [linkDetail, setLinkDetail] = useState<{ pageId: string; focus: LinkFocus } | null>(null);
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
    let cancelled = false;
    void load().catch((reason: Error & { code?: string }) => {
      if (cancelled) return;
      setAuth(reason.code === "auth");
      setError(reason.message);
      setPages([]);
    });
    return () => {
      cancelled = true;
    };
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
  }, [pages, filter, search, sort, dir]);

  function toggleSort(key: string) {
    setDir(sort === key && dir === "asc" ? "desc" : "asc");
    setSort(key);
  }

  const drawer = pages?.find((page) => page.id === drawerId) ?? null;
  const brokenPage = pages?.find((page) => page.id === brokenId) ?? null;
  const linkDetailPage = pages?.find((page) => page.id === linkDetail?.pageId) ?? null;

  function openLinkDetail(pageId: string, focus: LinkFocus = "all") {
    setLinkDetail({ pageId, focus });
  }

  const viewName = view === "links" ? "Link Check" : "Alle Seiten";
  const filterName = { all: "Alle", redirect: "Mit Redirect", broken: "Mit Linkfehlern", noindex: "Noindex", pathless: "Ohne Real Path" }[filter];
  const activeFilters = [
    { label: "Ansicht", value: viewName },
    { label: "Filter", value: filterName },
    ...(search.trim() ? [{ label: "Suche", value: search.trim() }] : []),
  ];
  const counts = {
    all: pages?.length ?? 0,
    links: pages?.length ?? 0,
  };
  const viewPages = pages ?? [];
  const filterCounts: Record<Filter, number> = {
    all: viewPages.length,
    redirect: viewPages.filter((page) => Boolean(page.redirectUrl)).length,
    broken: viewPages.filter((page) => page.broken.length > 0).length,
    noindex: viewPages.filter((page) => !page.index).length,
    pathless: viewPages.filter((page) => !page.realPath).length,
  };

  function openDrawer(page: PageRecord, nextTab: DrawerTab = "path") {
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

  function runLinkCheck() {
    clientApi<{ pages: PageRecord[] }>("/api/pages/check-links", { method: "POST" })
      .then((data) => {
        setPages(data.pages);
        ping(mode === "mock" ? "Linkprüfung aus den Beispieldaten." : "Linkprüfung abgeschlossen.");
      })
      .catch((reason: Error) => ping(reason.message));
  }

  return (
    <div className="seitencheck-app">
      <div className="sc-shell">
        <main className="sc-workspace">
          {error ? <p className="sc-error" role="alert">{error} {auth ? (
              // eslint-disable-next-line @next/next/no-html-link-for-pages
              <a href="/api/connect/seiten-check/storyblok">Mit Storyblok verbinden</a>
            ) : <button type="button" className="sc-link" onClick={() => load().catch(() => undefined)}>Erneut laden</button>}</p> : null}
          <section className="sc-table-card">
            <div className="sc-panel-header">
              <div className="sc-panel-headline">
                <nav className="sc-app-nav" aria-label="Apps">
                  <a className="sc-app-item current" href="/seiten-check" aria-current="page">Seiten-Check</a>
                  <a className="sc-app-item" href="/scriptverwaltung">Scriptverwaltung</a>
                </nav>
              </div>
              <div className="sc-viewnav" role="tablist" aria-label="Ansichten">
                {([
                  ["all", "Alle Seiten", counts.all],
                  ["links", "Link Check", counts.links],
                ] as const).map(([item, label, count]) => (
                  <button key={item} type="button" role="tab" aria-selected={view === item} className={`sc-viewtab ${view === item ? "active" : ""}`} onClick={() => { setView(item); setFilter("all"); }}>
                    <span>{label}</span>
                    <em>{count}</em>
                  </button>
                ))}
              </div>
            </div>
            {view === "links" ? (
              <TableToolsMenu tableId="seitencheck-links" appName="Seiten-Check" tableName="Link Check" columns={LINK_COLUMNS} rows={filtered} filters={activeFilters}>
                {(tools) => (
                  <>
                    <Toolbar search={search} setSearch={setSearch} onCheck={runLinkCheck} menu={tools.menu} />
                    <FilterLine filter={filter} setFilter={setFilter} counts={filterCounts} links />
                    <div className="sc-table-viewport sc-link-table">
                      <table className="sc-table">
                        <thead><tr>
                          {LINK_COLUMNS.filter((column) => tools.isVisible(column.id)).map((column) => (
                            <Th key={column.id} label={column.label} sortKey={column.id} sort={sort} dir={dir} onSort={toggleSort} width={linkWidths.widths[column.id] ?? 140} onWidth={(width) => linkWidths.setWidth(column.id, width)} onReset={() => linkWidths.resetWidth(column.id)} />
                          ))}
                          <th style={{ width: 96, minWidth: 96 }}>Aktionen</th>
                        </tr></thead>
                        <tbody>
                          {filtered.map((page) => {
                            const internal = page.outgoing.filter((link) => link.kind === "internal").length;
                            const external = page.outgoing.filter((link) => link.kind === "external").length;
                            return (
                              <tr key={page.id}>
                                {tools.isVisible("name") && <td><button type="button" className="sc-link-page" onClick={() => openDrawer(page, "links")}>{page.name}</button></td>}
                                {tools.isVisible("realPath") && <td>{page.realPath ? <span className="sc-code">{page.realPath}</span> : <span className="sc-blank">Kein Pfad</span>}</td>}
                                {tools.isVisible("outgoing") && <td><LinkCountButton count={page.outgoing.length} label="Ausgehende Links" primary onClick={() => openLinkDetail(page.id, "outgoing")} /></td>}
                                {tools.isVisible("internal") && <td><LinkCountButton count={internal} label="Intern ausgehende Links" onClick={() => openLinkDetail(page.id, "internal")} /></td>}
                                {tools.isVisible("incoming") && <td><LinkCountButton count={page.incoming.length} label="Intern eingehende Links" onClick={() => openLinkDetail(page.id, "incoming")} /></td>}
                                {tools.isVisible("external") && <td><LinkCountButton count={external} label="Extern ausgehende Links" onClick={() => openLinkDetail(page.id, "external")} /></td>}
                                {tools.isVisible("backlinks") && <td><span className="sc-canonical-auto">Nicht erfasst</span></td>}
                                {tools.isVisible("broken") && <td>{page.broken.length ? <button type="button" className="sc-badge warn" onClick={() => setBrokenId(page.id)}>{page.broken.length} fehlerhaft</button> : <span className="sc-badge good">Keine</span>}</td>}
                                <td style={{ width: 96, minWidth: 96 }}>
                                  <button type="button" className="sc-open-btn" aria-label={`Link-Details für ${page.name} öffnen`} onClick={() => openLinkDetail(page.id, "all")}>
                                    <span aria-hidden>↗</span>
                                    Öffnen
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
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
                    <Toolbar search={search} setSearch={setSearch} onCheck={runLinkCheck} menu={tools.menu} />
                    <FilterLine filter={filter} setFilter={setFilter} counts={filterCounts} />
                    <div className="sc-table-viewport">
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
                              {tools.isVisible("index") && <td><button type="button" className={`sc-robots-pill ${page.index ? "positive" : "caution"}`} onClick={() => save(page.id, { index: !page.index })}>{page.index ? "Index" : "Noindex"}</button></td>}
                              {tools.isVisible("follow") && <td><button type="button" className={`sc-robots-pill ${page.follow ? "positive" : "caution"}`} onClick={() => save(page.id, { follow: !page.follow })}>{page.follow ? "Follow" : "Nofollow"}</button></td>}
                              {tools.isVisible("canonical") && <td><CanonicalCell page={page} editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("redirect") && <td>{page.redirectUrl ? <span className="sc-status is-active"><span className="sc-status-dot" />Ja · 301</span> : <span className="sc-status is-inactive"><span className="sc-status-dot" />Nein</span>}</td>}
                              {tools.isVisible("redirectUrl") && <td><Cell page={page} field="redirectUrl" editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("redirectDate") && <td><span className="sc-tiny">{formatDeDate(page.redirectDate)}</span></td>}
                              {tools.isVisible("note") && <td><Cell page={page} field="note" editing={editing} setEditing={setEditing} save={save} /></td>}
                              {tools.isVisible("sitemap") && <td><button type="button" className={`sc-badge ${page.sitemap ? "good" : "neutral"}`} onClick={() => save(page.id, { sitemap: !page.sitemap })}>{page.sitemap ? "Ja" : "Nein"}</button></td>}
                              {tools.isVisible("broken") && <td>{page.broken.length ? <button type="button" className="sc-errors" onClick={() => setBrokenId(page.id)}>{page.broken.length} Fehler</button> : <span className="sc-errors is-clear">Keine</span>}</td>}
                              {tools.isVisible("updated") && <td><span className="sc-tiny">{formatDeDate(page.updatedAt)}</span></td>}
                              <td><button type="button" className="sc-edit-button" aria-label={`${page.name} bearbeiten`} onClick={() => openDrawer(page)}><PencilSimple size={16} weight="bold" aria-hidden /></button></td>
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
        </main>
      </div>
      {drawer && draft ? (
        <PageDrawer
          page={drawer}
          draft={draft}
          tab={tab}
          onTab={setTab}
          onDraft={setDraft}
          onClose={() => setDrawerId(null)}
          onSave={() => { void save(drawer.id, draft).then(() => setDrawerId(null)); }}
          onOpenSource={(id) => {
            const found = pages?.find((item) => item.id === id);
            if (found) openDrawer(found, "links");
          }}
          onOpenDetail={(focus) => openLinkDetail(drawer.id, focus)}
        />
      ) : null}
      {brokenPage ? (
        <div className="sc-modal-wrap" role="dialog" aria-modal="true" aria-label="Defekte Links">
          <div className="sc-modal-backdrop" onClick={() => setBrokenId(null)} />
          <div className="sc-modal sc-broken-modal">
            <div className="sc-modal-head"><div><div className="sc-smallcaps">LINKFEHLER</div><h2>{brokenPage.name}</h2></div><button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={() => setBrokenId(null)}><X size={16} weight="bold" aria-hidden /></button></div>
            <BrokenList page={brokenPage} />
          </div>
        </div>
      ) : null}
      {linkDetailPage && linkDetail ? (
        <LinkDetailModal
          page={linkDetailPage}
          focus={linkDetail.focus}
          onFocus={(focus) => setLinkDetail({ pageId: linkDetail.pageId, focus })}
          onClose={() => setLinkDetail(null)}
          onOpenSource={(id) => {
            setLinkDetail(null);
            const found = pages?.find((item) => item.id === id);
            if (found) openLinkDetail(found.id, "outgoing");
          }}
        />
      ) : null}
      {toast ? <div className="sc-toast" role="status">{toast}</div> : null}
    </div>
  );
}
