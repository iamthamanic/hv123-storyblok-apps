/**
 * Export der Seitenliste als CSV, JSON oder Excel-HTML.
 * Es werden nur die übergebenen Zeilen geschrieben.
 */

import type { PageRecord } from "@/lib/types";

const COLUMNS: { label: string; value: (page: PageRecord) => string }[] = [
  { label: "Seitenname", value: (page) => page.name },
  { label: "Domain", value: (page) => page.domain },
  { label: "Real Path", value: (page) => page.realPath },
  { label: "Redirect 301", value: (page) => (page.redirectUrl ? "ja" : "nein") },
  { label: "Redirect-Datum", value: (page) => page.redirectDate },
  { label: "Redirect-URL", value: (page) => page.redirectUrl },
  { label: "Notiz", value: (page) => page.note },
  { label: "Canonical", value: (page) => page.canonical },
  { label: "Index", value: (page) => (page.index ? "index" : "noindex") },
  { label: "Follow", value: (page) => (page.follow ? "follow" : "nofollow") },
  { label: "Sitemap", value: (page) => (page.sitemap ? "ja" : "nein") },
  { label: "Broken Links", value: (page) => String(page.broken.length) },
];

function cell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function pagesToCsv(pages: PageRecord[]): string {
  const header = COLUMNS.map((column) => cell(column.label)).join(";");
  const rows = pages.map((page) => COLUMNS.map((column) => cell(column.value(page))).join(";"));
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function pagesToJson(pages: PageRecord[]): string {
  return JSON.stringify(
    pages.map((page) => Object.fromEntries(COLUMNS.map((column) => [column.label, column.value(page)]))),
    null,
    2,
  );
}

export function pagesToXls(pages: PageRecord[]): string {
  const head = COLUMNS.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = pages
    .map((page) => `<tr>${COLUMNS.map((column) => `<td>${escapeHtml(column.value(page))}</td>`).join("")}</tr>`)
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body><table><tr>${head}</tr>${body}</table></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

export function scriptsToExport(scripts: unknown): string {
  return JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), scripts }, null, 2);
}
