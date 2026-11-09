"use client";

/**
 * Link-Detail-Modal mit Von→Nach-Tabelle.
 * Ort: /components/seiten-check/LinkDetailModal.tsx
 */

import { ArrowSquareOut, X } from "@phosphor-icons/react";
import type { LinkView, PageRecord } from "@/lib/types";
import type { LinkFocus } from "@/components/seiten-check/types";
import { linksForFocus, pageLiveUrl, resolveHref } from "@/components/seiten-check/link-utils";

export function LinkDetailModal({
  page,
  focus,
  onFocus,
  onClose,
  onOpenSource,
}: {
  page: PageRecord;
  focus: LinkFocus;
  onFocus: (focus: LinkFocus) => void;
  onClose: () => void;
  onOpenSource: (id: string) => void;
}) {
  const internal = page.outgoing.filter((link) => link.kind === "internal").length;
  const external = page.outgoing.filter((link) => link.kind === "external").length;
  const { outgoing, incoming } = linksForFocus(page, focus);
  const empty = outgoing.length === 0 && incoming.length === 0;
  const liveUrl = pageLiveUrl(page);
  const tabs: { id: LinkFocus; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: page.outgoing.length + page.incoming.length },
    { id: "outgoing", label: "Ausgehend", count: page.outgoing.length },
    { id: "internal", label: "Intern", count: internal },
    { id: "incoming", label: "Eingehend", count: page.incoming.length },
    { id: "external", label: "Extern", count: external },
  ];

  return (
    <div className="sc-modal-wrap" role="dialog" aria-modal="true" aria-label="Link-Details">
      <div className="sc-modal-backdrop" onClick={onClose} />
      <div className="sc-modal sc-link-modal">
        <div className="sc-modal-head">
          <div>
            <div className="sc-smallcaps">LINK-DETAILS</div>
            {liveUrl ? (
              <a className="sc-link-modal-title" href={liveUrl} target="_blank" rel="noopener noreferrer" title="Seite in neuem Tab öffnen">
                <span className="sc-link-modal-title-row">
                  <h2>{page.name}</h2>
                  <ArrowSquareOut size={16} weight="bold" aria-hidden />
                </span>
                <p className="sc-link-modal-path">{page.realPath}</p>
              </a>
            ) : (
              <>
                <h2>{page.name}</h2>
                <p className="sc-link-modal-path">Kein Real Path</p>
              </>
            )}
          </div>
          <button type="button" className="sc-icon-btn" aria-label="Schließen" onClick={onClose}><X size={16} weight="bold" aria-hidden /></button>
        </div>
        <div className="sc-link-focus" role="tablist" aria-label="Link-Kategorie">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={focus === tab.id}
              className={`sc-link-focus-tab ${focus === tab.id ? "active" : ""}`}
              onClick={() => onFocus(tab.id)}
            >
              {tab.label} <em>{tab.count}</em>
            </button>
          ))}
        </div>
        <div className="sc-link-modal-body">
          {empty ? (
            <div className="sc-emptybroken">
              <b>Keine Links in dieser Ansicht</b>
              <span>Andere Kategorie wählen oder Links prüfen ausführen.</span>
            </div>
          ) : null}
          {outgoing.length > 0 ? (
            <LinkFlowTable label="Ausgehend · von dieser Seite" ariaLabel="Ausgehende Links" links={outgoing} page={page} direction="outgoing" />
          ) : null}
          {incoming.length > 0 ? (
            <LinkFlowTable label="Eingehend · auf diese Seite" ariaLabel="Eingehende Links" links={incoming} page={page} direction="incoming" onOpenSource={onOpenSource} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function LinkFlowTable({
  label,
  ariaLabel,
  links,
  page,
  direction,
  onOpenSource,
}: {
  label: string;
  ariaLabel: string;
  links: LinkView[];
  page: PageRecord;
  direction: "outgoing" | "incoming";
  onOpenSource?: (id: string) => void;
}) {
  return (
    <section className="sc-link-flow-section" aria-label={ariaLabel}>
      <div className="sc-link-flow-label">{label}</div>
      <div className="sc-link-grid-wrap">
        <table className="sc-link-grid">
          <thead>
            <tr>
              <th scope="col">Von</th>
              <th className="sc-link-grid-arrow" scope="col"><span className="sc-sr-only">Richtung</span></th>
              <th scope="col">Nach</th>
              <th scope="col">Status</th>
              <th scope="col">Fundstelle</th>
            </tr>
          </thead>
          <tbody>
            {links.map((link, index) => (
              <LinkFlowRow key={`${direction}-${link.href}-${index}`} link={link} page={page} direction={direction} onOpenSource={onOpenSource} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LinkEndpoint({
  name,
  path,
  href,
  onActivate,
}: {
  name: string;
  path: string;
  href?: string | null;
  onActivate?: () => void;
}) {
  const body = (
    <>
      <span className="sc-link-end-name">
        <strong>{name}</strong>
        {href ? <ArrowSquareOut size={13} weight="bold" aria-hidden /> : null}
      </span>
      <code>{path}</code>
    </>
  );
  if (href) {
    return (
      <a className="sc-link-end is-open" href={href} target="_blank" rel="noopener noreferrer" title="Seite in neuem Tab öffnen">
        {body}
      </a>
    );
  }
  if (onActivate) {
    return (
      <button type="button" className="sc-link-end is-open" onClick={onActivate} title="Quellseite ansehen">
        {body}
      </button>
    );
  }
  return <div className="sc-link-end">{body}</div>;
}

function LinkFlowRow({
  link,
  page,
  direction,
  onOpenSource,
}: {
  link: LinkView;
  page: PageRecord;
  direction: "outgoing" | "incoming";
  onOpenSource?: (id: string) => void;
}) {
  const toHref = resolveHref(link.href, page.domain);
  const fromLive = pageLiveUrl(page);
  const toLabel = link.anchor || link.href;
  const fromLabel = direction === "outgoing" ? page.name : (link.sourceName || "Quellseite");
  const fromPath = direction === "outgoing" ? (page.realPath || "—") : "Quellseite";
  const statusLabel = link.broken ? (link.errorType || "Fehler") : link.status == null ? "Ungeprüft" : `HTTP ${link.status}`;
  const statusClass = link.broken ? "is-broken" : link.status == null ? "is-unknown" : "is-ok";
  const fundstelle = `${link.section} · ${link.component}${link.instanceTitle ? ` · ${link.instanceTitle}` : ""} · ${link.field}`;
  const message = link.message && link.message !== statusLabel ? link.message : "";

  return (
    <tr className={link.broken ? "is-broken" : undefined}>
      <td>
        <LinkEndpoint
          name={fromLabel}
          path={fromPath}
          href={direction === "outgoing" ? fromLive : null}
          onActivate={direction === "incoming" && onOpenSource ? () => onOpenSource(link.sourceId) : undefined}
        />
      </td>
      <td className="sc-link-grid-arrow" aria-hidden>→</td>
      <td>
        <LinkEndpoint name={direction === "outgoing" ? toLabel : page.name} path={link.href} href={toHref} />
      </td>
      <td>
        <div className="sc-link-grid-status">
          <span className={`sc-link-pill ${link.kind === "external" ? "external" : ""}`}>{link.kind === "internal" ? "Intern" : "Extern"}</span>
          <span className={`sc-link-status ${statusClass}`}>{statusLabel}</span>
          {link.rel === "nofollow" ? <span className="sc-link-pill muted">nofollow</span> : null}
        </div>
      </td>
      <td>
        <div className="sc-link-grid-meta">
          <span>{fundstelle}</span>
          {message ? <span className="sc-link-grid-msg">{message}</span> : null}
        </div>
      </td>
    </tr>
  );
}
