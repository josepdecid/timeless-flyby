// Strava doesn't let other sites fetch activity files (the export needs the user's Strava session and sends no
// CORS headers), so we can only point the browser at Strava's own GPX export and let the user drop the result.

export type StravaLinkResult = { kind: 'activity'; id: string } | { kind: 'short' } | { kind: 'invalid' };

/** Recognise a pasted Strava activity link (or a bare activity ID). */
export function parseStravaLink(input: string): StravaLinkResult {
  const s = input.trim();
  if (/^\d{5,}$/.test(s)) return { kind: 'activity', id: s };
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(s) ? s : `https://${s}`);
  } catch {
    return { kind: 'invalid' };
  }
  const host = url.hostname.toLowerCase();
  // App share links (strava.app.link/…) only redirect to the activity; the ID isn't in them.
  if (host === 'strava.app.link') return { kind: 'short' };
  if (host !== 'strava.com' && !host.endsWith('.strava.com')) return { kind: 'invalid' };
  const m = url.pathname.match(/^\/activities\/(\d+)(?:\/|$)/);
  return m ? { kind: 'activity', id: m[1] } : { kind: 'invalid' };
}

export function stravaGpxExportUrl(id: string): string {
  return `https://www.strava.com/activities/${id}/export_gpx`;
}
