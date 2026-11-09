/**
 * Einstieg zu den beiden Storyblok Space Apps.
 * Ort: /app/page.tsx
 */

import Link from "next/link";
import fieldMapping from "@/config/field-mapping.json";
import { resolveMode } from "@/lib/repository";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const mode = resolveMode();
  return (
    <main className="seitencheck-app">
      <div className="sc-workspace">
        <p className="sc-kicker">HALTEVERBOT123 · STORYBLOK</p>
        <h1 className="sc-h1">Website-Tools</h1>
        <p className="sc-sub">Zwei Space Apps für den Space {fieldMapping.spaceId}. Aktiver Modus: {mode}. Ohne Token startet der Mock mit den Beispieldaten aus dem Klickdummy.</p>
        <div className="sc-title-actions" style={{ marginTop: 18 }}>
          <Link className="sc-btn sc-btn-primary" href="/seiten-check">Seiten-Check</Link>
          <Link className="sc-btn" href="/scriptverwaltung">Scriptverwaltung</Link>
        </div>
        <p className="sc-help">Seitenwerte liegen im bestehenden Feld <code>seitenkonfiguration</code> (Custom Field <code>hv-seitenkonfiguration</code>). Der Scriptkatalog ist die Story <code>{fieldMapping.scriptCatalog.fullSlug}</code>. Das Mapping steht in <code>config/field-mapping.json</code>.</p>
      </div>
    </main>
  );
}
