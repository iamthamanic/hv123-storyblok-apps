import { describe, expect, it } from "vitest";
import { assemblePages } from "@/lib/assemble";
import { componentLabels } from "@/lib/labels";
import { applyPatch, readPageSettings, writePageSettings } from "@/lib/mapping";
import { initialScripts, initialStories, mockLinkStatus } from "@/lib/mock/fixtures";
import { moveScript, normalizeOrder, removeScript, scriptsToLoad, TERMLY_ID, validateScriptDraft } from "@/lib/order";
import { explainPageChange } from "@/lib/page-rules";
import { applyRedirectEdit, findRedirectLoop } from "@/lib/redirects";
import { applyRobotsChoice, assertMutuallyExclusive, normalizeRobots, RobotsConflictError, toStoredRobots } from "@/lib/robots";
import { brokenErrorType, isBrokenStatus, isPublicHttpUrl } from "@/lib/http-status";
import { extractLinks } from "@/lib/links";
import fieldMapping from "@/config/field-mapping.json";
import schemaGap from "@/config/schema-gap.json";
import fs from "node:fs";
import path from "node:path";

const labels = componentLabels;

describe("Robots", () => {
  it("lehnt Index und NoIndex gleichzeitig ab", () => {
    expect(() => assertMutuallyExclusive({ index: true, noindex: true })).toThrow(RobotsConflictError);
    expect(() => assertMutuallyExclusive({ follow: true, nofollow: true })).toThrow(RobotsConflictError);
  });

  it("speichert immer genau ein Paar und setzt die andere Seite", () => {
    const stored = toStoredRobots(applyRobotsChoice({ index: true, follow: true }, { index: false }));
    expect(stored).toEqual({ index: false, noindex: true, follow: true, nofollow: false });
    expect(stored.index && stored.noindex).toBe(false);
    expect(stored.follow && stored.nofollow).toBe(false);
  });

  it("löst widersprüchliche Rohdaten restriktiv auf", () => {
    const dirty = normalizeRobots({ index: true, noindex: true, follow: true, nofollow: true });
    expect(dirty.conflict).toBe(true);
    expect(dirty.index).toBe(false);
    expect(dirty.follow).toBe(false);
  });
});

describe("Reihenfolge", () => {
  it("pinnt Termly an Position 1 und lässt ihn nicht verschieben oder löschen", () => {
    const moved = moveScript(initialScripts, "meta_pixel", 0);
    expect(moved[0]?.id).toBe(TERMLY_ID);
    expect(moved.map((script) => script.id)).not.toEqual(initialScripts.map((script) => script.id));
    expect(moved.find((script) => script.id === "meta_pixel")?.order).toBeGreaterThan(1);
    const removed = removeScript(initialScripts, TERMLY_ID);
    expect(removed[0]?.id).toBe(TERMLY_ID);
    expect(removed[0]?.active).toBe(true);
    expect(removed[0]?.category).toBe("Notwendig");
  });

  it("lädt Termly zuerst und überspringt global oder je Seite ausgeschaltete Scripts ohne Einwilligung", () => {
    const toggled = initialScripts.map((script) => (script.id === "google_tag_manager" ? { ...script, active: false } : script));
    const loaded = scriptsToLoad(toggled, { meta_pixel: false, browo_tracking: true, zoho_pagesense: true }, { Analytik: true, Marketing: true });
    expect(loaded.map((script) => script.id)).toEqual(["termly", "browo_tracking", "zoho_pagesense"]);
    const blocked = scriptsToLoad(normalizeOrder(initialScripts), {}, { Marketing: false });
    expect(blocked.some((script) => script.category === "Marketing")).toBe(false);
    expect(blocked[0]?.id).toBe(TERMLY_ID);
  });

  it("verlangt Name, Quelle und Notiz, führt das Snippet aber nicht aus", () => {
    expect(validateScriptDraft({ name: "", details: "x", reason: "x", note: "x", category: "Analytik" })).toMatch(/Scriptnamen/);
    expect(validateScriptDraft({ name: "A", details: "x", reason: "x", note: "x", websiteUrl: "", sourceText: "", category: "Analytik" })).toMatch(/Quellenangabe/);
    expect(initialScripts.every((script) => typeof script.snippet === "string" && !script.snippet.includes("<script"))).toBe(true);
  });
});

describe("Redirects", () => {
  it("setzt das Datum nur beim ersten Aktivieren und leert es beim Entfernen", () => {
    const first = applyRedirectEdit({ redirectUrl: "", redirectDate: "" }, "/neu/", "2026-11-08T10:00:00.000Z");
    expect(first.redirectDate).toBe("2026-11-08T10:00:00.000Z");
    const kept = applyRedirectEdit(first, "/anders/", "2026-11-09T10:00:00.000Z");
    expect(kept.redirectDate).toBe(first.redirectDate);
    expect(applyRedirectEdit(kept, "", "2026-11-09T10:00:00.000Z").redirectDate).toBe("");
  });

  it("erkennt Schleifen und identische Ziele", () => {
    const rows = [
      { id: "1", realPath: "/alt/", redirectUrl: "/mittel/" },
      { id: "2", realPath: "/mittel/", redirectUrl: "" },
    ];
    expect(findRedirectLoop(rows, "2", "/mittel/", "/alt/", "website-dev.halteverbot123.de")).toMatch(/schleife/i);
    expect(findRedirectLoop(rows, "1", "/alt/", "/alt/", "website-dev.halteverbot123.de")).toMatch(/identisch/);
    expect(explainPageChange("1", { ...readPageSettings({ component: "page", seitenkonfiguration: { real_path: "" } }, "page", initialScripts), redirectUrl: "/x/" }, rows)).toMatch(/Real Path/);
  });
});

describe("Links und Mapping", () => {
  const pages = assemblePages({
    stories: initialStories,
    manuals: [],
    scripts: initialScripts,
    labels,
    statusFor: mockLinkStatus,
  });

  it("wertet 404 und 410 als defekt und ignoriert private Ziele", () => {
    expect(brokenErrorType(404)).toBe("404");
    expect(brokenErrorType(410)).toBe("410");
    expect(isBrokenStatus(200)).toBe(false);
    expect(isBrokenStatus(301)).toBe(false);
    expect(isPublicHttpUrl("http://127.0.0.1/geheim")).toBe(false);
    expect(isPublicHttpUrl("https://halteverbot123.de/fahrbahnmarkierungen")).toBe(true);
  });

  it("zieht interne und externe Links aus den echten Blockfeldern", () => {
    const berlin = pages.find((page) => page.name === "Halteverbot Berlin");
    expect(berlin?.realPath).toBe("/halteverbotszone/stadt/berlin/");
    expect(berlin?.outgoing.filter((link) => link.kind === "internal")).toHaveLength(3);
    expect(berlin?.outgoing.filter((link) => link.kind === "external")).toHaveLength(1);
    expect(berlin?.incoming.length).toBeGreaterThanOrEqual(5);
    const order = pages.find((page) => page.name === "Halteverbot Berlin bestellen");
    expect(order?.broken.map((link) => link.errorType).sort()).toEqual(["404", "410"]);
    expect(order?.redirectDate.startsWith("2026-11-06")).toBe(true);
    const draft = pages.find((page) => page.name.startsWith("Entrümpelung"));
    expect(draft?.realPath).toBe("");
    const raw = extractLinks(initialStories[1]?.content, labels, ["seitenkonfiguration"]);
    expect(raw.some((link) => link.rawHref.includes("fahrbahnmarkierungen") && link.instanceTitle === "Fahrbahnmarkierung")).toBe(true);
    expect(raw.some((link) => link.fieldKey === "redirect_url")).toBe(false);
  });

  it("mappt auf seitenkonfiguration und seo_noindex nur als Fallback der Partnerseite", () => {
    expect(fieldMapping.pageSettings.field).toBe("seitenkonfiguration");
    expect(fieldMapping.pageSettings.fieldType).toBe(schemaGap.pageSettingsFieldType);
    expect(schemaGap.rootsWithoutSeitenkonfiguration).toEqual(["global_settings"]);
    expect(schemaGap.seoNoindexComponents).toEqual(["partner_program_page"]);
    const partner = readPageSettings({ component: "partner_program_page", seo_noindex: true }, "partner_program_page", initialScripts);
    expect(partner.index).toBe(false);
    const written = writePageSettings({ component: "partner_program_page", body: [] }, { ...partner, index: true, follow: true }, "partner_program_page");
    const config = written.seitenkonfiguration as { index: boolean; noindex: boolean };
    expect(config.index).toBe(true);
    expect(config.noindex).toBe(false);
    expect(written.seo_noindex).toBe(false);
    expect(written.body).toEqual([]);
    const patched = applyPatch(partner, { redirectUrl: "/ziel/" }, "2026-11-08T00:00:00.000Z");
    expect(patched.redirectDate).toBe("2026-11-08T00:00:00.000Z");
  });

  it("bestätigt die Lücke am exportierten Component-Schema, wenn die Datei vorliegt", () => {
    const schemaPath = path.join(process.cwd(), "uploads/storyblok-components-schema_0df7.json");
    if (!fs.existsSync(schemaPath)) return;
    const data = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as { components: { name: string; is_root?: boolean; schema?: Record<string, { type?: string; field_type?: string }> }[] };
    const roots = data.components.filter((component) => component.is_root);
    const withField = roots.filter((component) => component.schema?.seitenkonfiguration?.field_type === "hv-seitenkonfiguration").map((component) => component.name);
    expect(withField).toEqual(schemaGap.rootsWithSeitenkonfiguration);
    const fieldNames = new Set(data.components.flatMap((component) => Object.keys(component.schema ?? {})));
    for (const missing of ["real_path", "redirect_url", "canonical", "tracking_browo"]) {
      expect(fieldNames.has(missing)).toBe(false);
    }
  });
});
