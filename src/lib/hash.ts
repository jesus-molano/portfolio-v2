/** The element id a URL fragment names ("#contact" → "contact"), or null for none. */
export function idFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    // A malformed escape: the browser looks the raw text up too.
    return raw;
  }
}
