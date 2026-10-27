import { t } from '../i18n.svelte';

// Namespace-agnostic helpers: GPX/TCX files in the wild mix default namespaces,
// prefixed extensions (gpxtpx:, ns3:) and no namespace at all.

export function parseXml(text: string): Document {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error(t.parse.notXml);
  return doc;
}

export function byName(root: Element | Document, localName: string): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(root.getElementsByTagName('*'))) if (el.localName === localName) out.push(el);
  return out;
}

/** First nested descendant with the given local name. */
export function first(root: Element, localName: string): Element | undefined {
  for (const el of Array.from(root.getElementsByTagName('*'))) if (el.localName === localName) return el;
  return undefined;
}

export function childText(root: Element, localName: string): string | undefined {
  for (const c of Array.from(root.children)) {
    if (c.localName === localName) return c.textContent?.trim() || undefined;
  }
  return undefined;
}

export function num(s: string | null | undefined): number | undefined {
  if (s == null || s === '') return undefined;
  const v = Number(s);
  return Number.isFinite(v) ? v : undefined;
}
