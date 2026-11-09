# UI Styleguide

**Status:** binding for Seiten-Check + Scriptverwaltung

## Tokens (Seiten-Check)

| Role | Value |
|------|-------|
| Ink | `#12324e` / `#173a56` |
| Muted | `#7d90a1` |
| Accent blue | `#1a6db5` / `#205e9e` |
| Orange CTA | `#f18a24` (use sparingly) |
| Surface | `#f7f9fc` app, `#fff` cards |
| Border | `#e4ecf3` |
| Radius | 8–12px |
| Focus ring | `#91bfe6` 3px |

CSS root: `styles/seitencheck.css`, `styles/scriptverwaltung.css`, `styles/table-tools.css`.

## Canonical patterns

### App switcher

`.sc-app-nav` / `.sc-app-item` — pill segmented control for Seiten-Check ↔ Scriptverwaltung.

### View / drawer tabs

Pill tabs (`.sc-viewtab`, `.sc-tab`) with optional count `<em>`. Active = filled navy, not underline-only.

### Tables

- Shared menu: `TableToolsMenu` (export + column config)
- Resizable headers via `useColumnWidths`
- Filter chips with counts (`.sc-filterchip`)

### Drawer

`.sc-drawer` with card sections (`.sc-drawer-card`): titled groups, not bare stacked labels.

### Link details

Von → Nach as `.sc-link-grid` table; endpoints open in new tab with ArrowSquareOut affordance.

### Modals

`.sc-modal-wrap` + backdrop; title `font-weight: 800`.

## Do not

- Reintroduce god-file UI in `SeitenCheckApp.tsx`
- Add a second export/column menu implementation
- Use purple/glow AI-default chrome
