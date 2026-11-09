/**
 * Anzeigenamen aus dem Component-Schema, nur für Fundstellen in der Linkprüfung.
 */

import labelsJson from "@/config/component-labels.json";
import type { LabelBook } from "@/lib/links";

export const componentLabels = labelsJson as unknown as LabelBook;
