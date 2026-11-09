# Halteverbot123 Website-Tools

Zwei Storyblok Space Apps für den Space `289379092634862` (Region EU, Management API `https://mapi.storyblok.com/v1`):

- **Seiten-Check** unter `/seiten-check`
- **Scriptverwaltung** unter `/scriptverwaltung`

Die Apps sprechen die Management API direkt an. Das Website-Repo wird nicht gebraucht. Was nur die Website tun kann (Scripts nach Termly laden, 301 ausführen, Canonical und Robots ausgeben, Sitemap bauen), liegt als dokumentiertes JSON in Storyblok.

Ohne Zugangsdaten läuft der **Mock-Modus** mit den Beispieldaten aus dem Klickdummy. Snippets werden nur gespeichert, nie ausgeführt.

## Lokal starten

```bash
npm install
cp .env.example .env.local
npm run dev
```

Die App liegt auf [http://127.0.0.1:43123](http://127.0.0.1:43123).

`APP_MODE` steuert die Datenquelle:

| Modus | Bedeutung |
| --- | --- |
| `mock` | Beispieldaten in `.data/mock-store.json`. Standard, wenn kein Token gesetzt ist. Nur lokal. |
| `pat` | Personal Access Token aus `STORYBLOK_PAT`. **Nur lokal / VPN** — in Production sind Schreib-APIs ohne `ALLOW_PAT_WRITES=true` gesperrt. |
| `oauth` | Session der installierten Space App. **Pflicht für öffentliches Deployment.** |

Ist `APP_MODE` leer und `STORYBLOK_PAT` gesetzt, wird `pat` verwendet. Tokens gehören in `.env.local`, nicht ins Repository.

```bash
npm test
npm run typecheck
npm run lint
```

## 1. Deployment

Die App ist ein normales Next.js-Projekt (Node-Runtime, `output: "standalone"`).

### Vercel

1. Repository verbinden, Framework Next.js.
2. Umgebungsvariablen aus `.env.example` setzen. `APP_URL` ist die https-Adresse der Installation, zum Beispiel `https://tools.example.com`.
3. `APP_MODE=oauth` für den Betrieb in Storyblok (öffentlich). `APP_MODE=pat` nicht auf dem öffentlichen Internet nutzen — die HTTP-API wäre sonst ohne Session schreibend.
4. Deploy. Die Seiten sind `/seiten-check` und `/scriptverwaltung`.

### Hostinger Node.js oder ein anderer Node-Host

```bash
npm ci
npm run build
npm start
```

`npm start` hört auf `0.0.0.0` und den Port aus `PORT` (sonst 43123). Alternativ das Standalone-Bündel:

```bash
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static
PORT=43123 node .next/standalone/server.js
```

`APP_URL` muss danach exakt die öffentliche https-Adresse sein, ohne Slash am Ende.

## 2. In Storyblok registrieren

Es sind zwei Apps, weil der Space zwei Einträge in der Seitenleiste bekommt. Beide zeigen auf dieselbe Installation, mit jeweils eigener OAuth-Client-ID.

Die Callback-URLs lauten:

- Seiten-Check: `https://<APP_URL>/api/connect/seiten-check/callback`
- Scriptverwaltung: `https://<APP_URL>/api/connect/scriptverwaltung/callback`

Die Anmeldung startet unter:

- `https://<APP_URL>/api/connect/seiten-check/storyblok`
- `https://<APP_URL>/api/connect/scriptverwaltung/storyblok`

`APP_URL` muss `https` sein. Das verlangt Storyblok und `@storyblok/app-extension-auth`.

### Partner Portal

1. [Storyblok Partner Portal](https://app.storyblok.com) öffnen und in die Organisation wechseln, der der Space gehört.
2. **Organization → Apps → Create App**. Zweimal ausführen.
3. App 1, Name `Seiten-Check`, Typ **Space plugin** / Sidebar app.
   - App URL: `https://<APP_URL>/seiten-check`
   - OAuth Redirect URI: `https://<APP_URL>/api/connect/seiten-check/callback`
   - Region: EU
4. App 2, Name `Scriptverwaltung`.
   - App URL: `https://<APP_URL>/scriptverwaltung`
   - OAuth Redirect URI: `https://<APP_URL>/api/connect/scriptverwaltung/callback`
5. Rechte (Scopes) beider Apps: `stories:read`, `stories:write`, `components:read`, `components:write`. Die Komponentenrechte braucht die Scriptverwaltung, weil `hv_script_catalog` und `hv_seo_redirects` im Space noch nicht existieren und beim ersten Speichern angelegt werden.
6. Client ID und Client Secret in `SEITENCHECK_CLIENT_ID` / `SEITENCHECK_CLIENT_SECRET` beziehungsweise `SCRIPTVERWALTUNG_CLIENT_ID` / `SCRIPTVERWALTUNG_CLIENT_SECRET` hinterlegen und neu deployen. Ein gemeinsames Paar `STORYBLOK_CLIENT_ID` / `STORYBLOK_CLIENT_SECRET` ist nur ein Notbehelf, wenn beide Apps dieselbe OAuth-App sind.

### In den Space installieren

1. Space `289379092634862` öffnen.
2. **Settings → Apps** (oder über den Install-Link der App im Partner Portal).
3. Seiten-Check installieren und den Zugriff bestätigen. Storyblok öffnet die App-URL im iframe und hängt `space_id` und nach dem OAuth `user_id` an.
4. Dasselbe für Scriptverwaltung.
5. Beide Apps erscheinen in der Space-Seitenleiste. Ein Klick lädt das iframe. Fehlt die Session, verweist die Oberfläche auf „Mit Storyblok verbinden“.

Lokale Entwicklung gegen Live-Daten geht ohne OAuth über `APP_MODE=pat` und `STORYBLOK_PAT`.

## 3. Hinweise für den Website-Entwickler

Die Website liest die **Delivery API** (`https://api.storyblok.com/v2/cdn`), nicht die Management API. Änderungen aus den Apps sind für die Website erst sichtbar, wenn die Story veröffentlicht ist. Dafür `STORYBLOK_AUTO_PUBLISH=true` setzen oder in Storyblok veröffentlichen.

### Wo das Mapping steht

`config/field-mapping.json`

Dort liegen Space-ID, Domains, der Feldname `seitenkonfiguration`, alle Schlüssel darin und die Slugs der Konfigurations-Stories. Dieselbe Datei liest der Beispielcode in `examples/nextjs/read-halteverbot-config.ts`.

### Was im Component-Schema schon existiert

Aus dem Export der 205 Komponenten:

- Auf 27 Root-Komponenten gibt es das Custom Field `seitenkonfiguration` vom Typ `hv-seitenkonfiguration`. Die Beschreibung nennt Tracking nach Termly, Follow/Index, Sitemap, Canonical und Weiterleitung. `global_settings` hat dieses Feld nicht.
- `seo_title` und meist `seo_description` liegen auf den SEO-Tabs. **Ohne** `seo_title`: `bestellen_page`, `bewertungen_page`, `preis_anfrage_page`.
- `seo_noindex` (Boolean) gibt es **nur** auf `partner_program_page`. Die App liest es als Fallback, wenn in `seitenkonfiguration` noch kein Index-Paar steht, und schreibt es beim Speichern mit (`true` genau dann, wenn Noindex gilt).

### Was es als Schema-Feld noch nicht gibt

Die Management API exportiert den Inhalt eines Custom Fields nicht als Einzelfelder. Diese Schlüssel sind deshalb nicht unter den 205 Komponenten zu finden. Die Apps lesen und schreiben sie **innerhalb** von `content.seitenkonfiguration`. Das JSON-Schema dazu ist `config/seitenkonfiguration.schema.json`.

| Schlüssel | Bedeutung |
| --- | --- |
| `real_path` | Öffentlicher Pfad. Leer lassen, wenn keiner gesetzt ist. Nicht der Storyblok-Slug. |
| `domain` | Host ohne Protokoll. Leer = `website-dev.halteverbot123.de`. |
| `redirect_301`, `redirect_url`, `redirect_date` | 301. Das Datum setzt die App, wenn eine Weiterleitung neu aktiv wird, und leert es, wenn sie weg ist. |
| `note` | Interne Notiz. |
| `canonical` | Leer = die Website bestimmt das Canonical selbst. |
| `index` / `noindex`, `follow` / `nofollow` | Immer ein Paar. Nie beide `true`. |
| `sitemap` | `true` = in die Sitemap aufnehmen. |
| `tracking_browo`, `tracking_gtm`, `tracking_meta_pixel`, `tracking_zoho_pagesense` | Bestehende Seitentoggles. Default `true`, wenn der Schlüssel fehlt. |
| `tracking_extras` | Weitere Script-IDs aus dem Katalog, die keine der vier festen Toggles sind. |

Der Scriptkatalog und manuelle Redirects ohne Story haben noch keine Komponente:

- Story `config/scriptverwaltung`, Komponente `hv_script_catalog`, Textarea `catalog_json`
- Story `config/seo-redirects`, Komponente `hv_seo_redirects`, Textarea `redirects_json`

Schema: `config/script-catalog.schema.json`. Die App legt Komponente, Ordner und Story beim ersten Speichern im PAT- oder OAuth-Modus an.

### Redirects

```ts
// middleware.ts oder die passende Route
const seo = await loadPageSeo(slug, process.env.STORYBLOK_TOKEN!);
if (seo.redirect) {
  return NextResponse.redirect(new URL(seo.redirect.destination, request.url), 301);
}
```

`redirect.destination` ist ein Pfad (`/neue-seite/`) oder eine https-URL. Die Website muss die Schleife nicht noch einmal prüfen; die App lehnt Schleifen beim Speichern ab.

### Canonical, Robots, Sitemap

```tsx
export async function generateMetadata({ params }: { params: Promise<{ slug?: string[] }> }) {
  const slug = (await params).slug?.join("/") || "home";
  const seo = await loadPageSeo(slug, process.env.STORYBLOK_TOKEN!);
  const path = seo.realPath || `/${slug}`;
  return {
    title: seo.seoTitle || undefined,
    alternates: { canonical: seo.canonical || path },
    robots: seo.robots, // "index, follow" oder "noindex, nofollow"
  };
}
```

In die Sitemap gehören nur Stories mit `sitemap === true`, ohne `redirect_url`, mit gesetztem `real_path` (oder bewusst dem Slug, den die Website dafür definiert). `partner_program_page.seo_noindex === true` bedeutet zusätzlich Noindex, falls `seitenkonfiguration.index` noch nicht gepflegt ist. Sobald die App das Paar schreibt, gilt das Paar.

### Scripts laden

Reihenfolge und Filter stehen in `scriptsToLoad` (`lib/order.ts`):

1. Katalog aus `config/scriptverwaltung` lesen (`catalog_json`).
2. Termly bleibt an Position 1, Kategorie Notwendig, immer aktiv.
3. Global `active: false` überspringen.
4. Seitenschalter `false` überspringen (`tracking_browo` und so weiter, sonst `tracking_extras`).
5. Kategorie Notwendig immer laden. Analytik, Marketing und Funktional nur nach der Termly-Einwilligung.

```tsx
"use client";
import Script from "next/script";
import type { ScriptRecord } from "@/lib/types";

export function ConsentedScripts({ scripts }: { scripts: ScriptRecord[] }) {
  return (
    <>
      {scripts.map((script) => (
        <Script id={script.id} key={script.id} strategy="afterInteractive">
          {script.snippet}
        </Script>
      ))}
    </>
  );
}
```

Das gehört ins Website-Repo, nicht in diese Space App. Die Space App rendert Snippets nur in einem Textfeld.

Ein vollständiger Lese-Ablauf liegt in `examples/nextjs/read-halteverbot-config.ts`.

## Tabellenmenü

Jede Tabelle nutzt `components/table/TableToolsMenu.tsx` (Vorlage: Business Ultra `FunnelExportMenu`).

Der Button ist 32×32 und transparent, Icon `DotsThree`. Das Menü schließt bei Klick daneben und bei Esc.

- **Exportieren** öffnet ein Modal mit CSV, JSON, XLS und PDF. CSV ist vorausgewählt. CSV ist Semikolon-getrennt und hat ein BOM. JSON ist die Roh-Payload. XLS ist Excel-XML. PDF öffnet eine Druckseite; blockiert der Browser das Fenster, wird dieselbe HTML-Datei heruntergeladen.
- Der Export enthält einen Kopf (Tabelle, App, Datum), die aktiven Filter und danach nur die **sichtbaren Spalten** der **gefilterten Zeilen**. Dateiname: `{App}_{Tabelle}_{Datum}`.
- **Spalten** zeigt eine Checkbox je Spalte sowie „Alle anzeigen“ und „Zurücksetzen“. Die Auswahl liegt in `localStorage` unter `hv-table-columns:<tabellen-id>`.

## Feldherkunft in Kurzform

| Anliegen | Quelle |
| --- | --- |
| Seitenname | Story-Name |
| SEO-Titel | `content.seo_title`, wo die Komponente das Feld hat |
| Real Path, Redirect, Datum, Notiz, Canonical, Index/Follow, Sitemap, Seitentoggles | `content.seitenkonfiguration.*` laut Mapping |
| Noindex nur Partnerprogramm | zusätzlich `content.seo_noindex` |
| Scriptkatalog | Story `config/scriptverwaltung` |
| Manuelle 301 ohne Story | Story `config/seo-redirects` |
| Defekte Links | berechnet (404 und 410), nicht gespeichert |
| Eingehende Backlinks fremder Domains | nicht erfasst |

## Recent changes

- **2026-11-09** — Seiten-Check in Module (Drawer, Link-Detail, Table-Parts) zerlegt; Tabellenmenü/Export und Styles geschärft; Docs (`docs/`, `AGENTS.md`) ergänzt (`master`)
