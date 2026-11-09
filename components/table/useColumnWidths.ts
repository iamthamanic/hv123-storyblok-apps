"use client";

/**
 * Spaltenbreiten je Tabelle. Ziehen, Doppelklick und Pfeiltasten wie im Klickdummy.
 * Ort: /components/table/useColumnWidths.ts
 */

import { useEffect, useRef, useState } from "react";

export function useColumnWidths(storageKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState(defaults);
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null") as Record<string, number> | null;
      if (saved && typeof saved === "object") setWidths({ ...defaultsRef.current, ...saved });
    } catch {
      /* Private Mode */
    }
  }, [storageKey]);

  function commit(next: Record<string, number>) {
    setWidths(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Private Mode */
    }
  }

  function setWidth(id: string, width: number) {
    const size = Math.max(70, Math.min(950, Math.round(width)));
    setWidths((current) => {
      const next = { ...current, [id]: size };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* Private Mode */
      }
      return next;
    });
  }

  function resetWidth(id: string) {
    commit({ ...widths, [id]: defaults[id] ?? 140 });
  }

  return { widths, setWidth, resetWidth };
}
