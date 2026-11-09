/**
 * Sichtbarkeit von Tabellenspalten. Gespeichert wird pro Tabelle in localStorage.
 * Die reine Auflösung liegt hier, damit Tests ohne Browser auskommen.
 */

export type ColumnMeta = {
  id: string;
  label: string;
  hideable?: boolean;
  defaultVisible?: boolean;
};

export function columnStorageKey(tableId: string): string {
  return `hv-table-columns:${tableId}`;
}

export function defaultVisibility(columns: ColumnMeta[]): Record<string, boolean> {
  return Object.fromEntries(columns.map((column) => [column.id, column.defaultVisible !== false]));
}

export function resolveColumnVisibility(columns: ColumnMeta[], saved: unknown): Record<string, boolean> {
  const next = defaultVisibility(columns);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return next;
  const record = saved as Record<string, unknown>;
  for (const column of columns) {
    if (column.hideable === false) {
      next[column.id] = true;
      continue;
    }
    if (typeof record[column.id] === "boolean") next[column.id] = record[column.id] as boolean;
  }
  return next;
}

export function isColumnVisible(column: ColumnMeta, visibility: Record<string, boolean>): boolean {
  if (column.hideable === false) return true;
  return visibility[column.id] !== false;
}
