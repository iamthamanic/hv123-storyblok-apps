"use client";

/**
 * Seitenkonfiguration-Drawer inkl. Linkfehler- und Link-Listen.
 * Ort: /components/seiten-check/PageDrawer.tsx
 */

import { ArrowSquareOut, X } from "@phosphor-icons/react";
import { formatDeDate } from "@/components/shared/client-api";
import type { LinkFocus, DrawerTab } from "@/components/seiten-check/types";
import { resolveHref } from "@/components/seiten-check/link-utils";
import type { PagePatch, PageRecord } from "@/lib/types";

export function PageDrawer({
  page,
  draft,
  tab,
  onTab,
  onDraft,
  onClose,
  onSave,
  onOpenSource,
  onOpenDetail,
}: {
  page: PageRecord;
  draft: PagePatch;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onDraft: (draft: PagePatch) => void;
  onClose: () => void;
  onSave: () => void;
  onOpenSource: (id: string) => void;
  onOpenDetail: (focus: LinkFocus) => void;
}) {
  return (
    <div className="sc-dimmer" onClick={onClose}>
      <aside className="sc-drawer" role="dialog" aria-label="Seitenkonfiguration" onClick={(event) => event.stopPropagation()}>
        <div className="sc-drawer-head">
          <div className="sc-drawer-top">
            <div className="sc-drawer-titleblock">
              <div className="sc-smallcaps">Seitenkonfiguration</div>
              <h2>{page.name}</h2>
              <div className="sc-drawer-meta">
                <span className="sc-drawer-domain">{page.domain}</span>
                <code className="sc-drawer-path">{page.realPath || "Kein Real Path hinterlegt"}</code>
              </div>
            </div>
            <button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={onClose}><X size={16} weight="bold" aria-hidden /></button>
          </div>
          <div className="sc-tabs" role="tablist" aria-label="Einstellungen">
            {([
              ["path", "URL & Redirect", null],
              ["seo", "SEO & Tracking", null],
              ["broken", "Linkfehler", page.broken.length],
              ["links", "Link Check", page.outgoing.length + page.incoming.length],
            ] as const).map(([key, label, count]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} className={`sc-tab ${tab === key ? "active" : ""}`} onClick={() => onTab(key)}>
                <span>{label}</span>
                {count != null ? <em>{count}</em> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="sc-drawer-scroll">
          {tab === "path" ? <PathTab draft={draft} onDraft={onDraft} /> : null}
          {tab === "seo" ? <SeoTab page={page} draft={draft} onDraft={onDraft} /> : null}
          {tab === "broken" ? <BrokenList page={page} /> : null}
          {tab === "links" ? <LinkList page={page} onOpen={onOpenSource} onOpenDetail={onOpenDetail} /> : null}
        </div>
        <div className="sc-drawer-foot">
          <small>{page.component ?? "manuell"} · {formatDeDate(page.updatedAt)}</small>
          {tab === "path" || tab === "seo" ? (
            <button type="button" className="sc-btn sc-btn-primary" onClick={onSave}>Änderungen speichern</button>
          ) : (
            <button type="button" className="sc-btn" onClick={onClose}>Schließen</button>
          )}
        </div>
      </aside>
    </div>
  );
}

function PathTab({ draft, onDraft }: { draft: PagePatch; onDraft: (draft: PagePatch) => void }) {
  return (
    <div className="sc-drawer-stack">
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>Öffentliche URL</h3>
          <p>Real Path der Seite auf der Live-Domain.</p>
        </div>
        <label className="sc-field">
          <span className="sc-field-label">Real Path</span>
          <input className="sc-input" value={draft.realPath ?? ""} onChange={(event) => onDraft({ ...draft, realPath: event.target.value })} placeholder="/beispiel-seite/" />
        </label>
      </section>
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>301-Weiterleitung</h3>
          <p>Optional: Ziel-URL, wenn diese Seite weiterleiten soll.</p>
        </div>
        <label className="sc-field">
          <span className="sc-field-label">Ziel-URL</span>
          <input className="sc-input" value={draft.redirectUrl ?? ""} onChange={(event) => onDraft({ ...draft, redirectUrl: event.target.value })} placeholder="/ziel-seite/ oder https://…" />
        </label>
        <div className={`sc-route ${draft.redirectUrl ? "" : "empty"}`}>
          <div className="sc-route-head">{draft.redirectUrl ? "Weiterleitung aktiv" : "Keine Weiterleitung"}</div>
          <div className="sc-route-path">{draft.realPath || "—"}</div>
          {draft.redirectUrl ? (
            <>
              <div className="sc-route-arrow" aria-hidden />
              <div className="sc-route-path dst">{draft.redirectUrl}</div>
            </>
          ) : (
            <p className="sc-help">Leer lassen, wenn die Seite selbst ausgeliefert wird.</p>
          )}
        </div>
      </section>
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>Interne Notiz</h3>
          <p>Nur fürs Team sichtbar, nicht auf der Website.</p>
        </div>
        <label className="sc-field">
          <span className="sc-field-label">Notiz</span>
          <textarea className="sc-textarea" value={draft.note ?? ""} onChange={(event) => onDraft({ ...draft, note: event.target.value })} placeholder="Warum Redirect, offene TODOs…" />
        </label>
      </section>
    </div>
  );
}

function SeoTab({ page, draft, onDraft }: { page: PageRecord; draft: PagePatch; onDraft: (draft: PagePatch) => void }) {
  return (
    <div className="sc-drawer-stack">
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>Robots & Sitemap</h3>
          <p>Steuert Indexierung und Sichtbarkeit.</p>
        </div>
        <div className="sc-control-row"><b>Indexierung</b><div className="sc-segment"><button type="button" className={draft.index ? "active" : ""} onClick={() => onDraft({ ...draft, index: true })}>Index</button><button type="button" className={!draft.index ? "active" : ""} onClick={() => onDraft({ ...draft, index: false })}>Noindex</button></div></div>
        <div className="sc-control-row"><b>Link-Crawling</b><div className="sc-segment"><button type="button" className={draft.follow ? "active" : ""} onClick={() => onDraft({ ...draft, follow: true })}>Follow</button><button type="button" className={!draft.follow ? "active" : ""} onClick={() => onDraft({ ...draft, follow: false })}>Nofollow</button></div></div>
        <div className="sc-switch-row is-last"><div><b>In Sitemap aufnehmen</b></div><button type="button" className={`sc-switch ${draft.sitemap ? "on" : ""}`} aria-pressed={draft.sitemap} onClick={() => onDraft({ ...draft, sitemap: !draft.sitemap })}><span /></button></div>
      </section>
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>Canonical & SEO-Titel</h3>
          <p>Leerer Canonical nutzt automatisch den Real Path.</p>
        </div>
        <label className="sc-field">
          <span className="sc-field-label">Canonical Tag</span>
          <input className="sc-input" value={draft.canonical ?? ""} onChange={(event) => onDraft({ ...draft, canonical: event.target.value })} placeholder={draft.realPath || "/…"} />
        </label>
        <div className="sc-field">
          <span className="sc-field-label">SEO-Titel</span>
          {page.hasSeoTitleField ? <div className="sc-readonly">{page.seoTitle || "—"}</div> : <p className="sc-help">Diese Komponente hat kein Feld seo_title.</p>}
        </div>
      </section>
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head">
          <h3>Tracking auf dieser Seite</h3>
          <p>Lädt nur, wenn das Script global aktiv ist und Termly zustimmt.</p>
        </div>
        {page.tracking.length === 0 ? <p className="sc-help">Keine Tracking-Schalter für diese Seite.</p> : null}
        {page.tracking.map((item, index) => (
          <div key={item.id} className={`sc-switch-row ${index === page.tracking.length - 1 ? "is-last" : ""}`}>
            <div><b>{item.name}</b><small>{item.category}</small></div>
            <button type="button" className={`sc-switch ${draft.tracking?.[item.id] ? "on" : ""}`} onClick={() => onDraft({ ...draft, tracking: { ...draft.tracking, [item.id]: !draft.tracking?.[item.id] } })}><span /></button>
          </div>
        ))}
      </section>
    </div>
  );
}

export function BrokenList({ page }: { page: PageRecord }) {
  if (!page.broken.length) {
    return (
      <div className="sc-drawer-stack">
        <section className="sc-drawer-card">
          <div className="sc-emptybroken">
            <b>Keine defekten Links</b>
            <span>404 und 410 erscheinen hier, sobald die Prüfung sie findet.</span>
          </div>
        </section>
      </div>
    );
  }
  return (
    <div className="sc-drawer-stack">
      {page.broken.map((link, index) => {
        const href = resolveHref(link.href, page.domain);
        return (
          <section key={`${link.href}-${index}`} className="sc-drawer-card sc-issue-card">
            <div className="sc-issuehead">
              <div className="sc-issue-title">
                <b>{link.anchor || `Fehler ${index + 1}`}</b>
                <span className="sc-errorcode">{link.errorType || "Fehler"}</span>
              </div>
              {href ? <a className="sc-link-row-side" href={href} target="_blank" rel="noopener noreferrer">URL öffnen</a> : null}
            </div>
            <code className="sc-issueurl">{link.href}</code>
            <div className="sc-issuepath">{link.section} <span className="sc-sep">›</span> {link.component}{link.instanceTitle ? <> <span className="sc-sep">›</span> {link.instanceTitle}</> : null} <span className="sc-sep">›</span> <b>{link.field}</b></div>
            <div className="sc-issuefoot">{link.message}</div>
            {page.editorUrl ? <a className="sc-link" href={page.editorUrl} target="_blank" rel="noopener noreferrer">Story in Storyblok öffnen</a> : null}
          </section>
        );
      })}
    </div>
  );
}

function LinkList({
  page,
  onOpen,
  onOpenDetail,
}: {
  page: PageRecord;
  onOpen: (id: string) => void;
  onOpenDetail?: (focus: LinkFocus) => void;
}) {
  return (
    <div className="sc-drawer-stack">
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head sc-drawer-card-head-row">
          <div>
            <h3>Ausgehend</h3>
            <p>{page.outgoing.length} Links von dieser Seite.</p>
          </div>
          {onOpenDetail ? <button type="button" className="sc-link-row-side" onClick={() => onOpenDetail("outgoing")}>Als Tabelle</button> : null}
        </div>
        {page.outgoing.length === 0 ? <p className="sc-help">Keine ausgehenden Links.</p> : null}
        <div className="sc-drawer-link-list">
          {page.outgoing.map((link, index) => {
            const href = resolveHref(link.href, page.domain);
            return (
              <article key={`out-${index}`} className={`sc-drawer-link ${link.broken ? "is-broken" : ""}`}>
                <div className="sc-drawer-link-top">
                  <span className={`sc-link-pill ${link.kind === "external" ? "external" : ""}`}>{link.kind === "internal" ? "Intern" : "Extern"}</span>
                  {link.broken ? <span className="sc-link-status is-broken">{link.errorType || "Fehler"}</span> : null}
                </div>
                {href ? (
                  <a className="sc-drawer-link-title" href={href} target="_blank" rel="noopener noreferrer">
                    <strong>{link.anchor || link.href}</strong>
                    <ArrowSquareOut size={13} weight="bold" aria-hidden />
                  </a>
                ) : (
                  <strong className="sc-drawer-link-title">{link.anchor || link.href}</strong>
                )}
                <code>{link.href}</code>
                <small>{link.section} · {link.component} · {link.field}</small>
              </article>
            );
          })}
        </div>
      </section>
      <section className="sc-drawer-card">
        <div className="sc-drawer-card-head sc-drawer-card-head-row">
          <div>
            <h3>Eingehend</h3>
            <p>{page.incoming.length} interne Links auf diese Seite.</p>
          </div>
          {onOpenDetail ? <button type="button" className="sc-link-row-side" onClick={() => onOpenDetail("incoming")}>Als Tabelle</button> : null}
        </div>
        {page.incoming.length === 0 ? <p className="sc-help">Keine andere Story verlinkt hierher.</p> : null}
        <div className="sc-drawer-link-list">
          {page.incoming.map((link, index) => (
            <article key={`in-${index}`} className="sc-drawer-link">
              <strong className="sc-drawer-link-title">{link.sourceName || "Quellseite"}</strong>
              <code>{link.href}</code>
              <small>Anker: {link.anchor || "—"} · {link.section} · {link.component}</small>
              <button type="button" className="sc-text-link" onClick={() => onOpen(link.sourceId)}>Quellseite ansehen</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
