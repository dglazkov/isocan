import type { TextFont } from "@isocan/core";

/**
 * **A named font's file, fetched only when a node on the canvas names one**
 * (30 Sep 2026).
 *
 * The app page carries no Content-Security-Policy of its own — the daemon's
 * `sandbox allow-scripts` header is on BLOB responses, and the content origin's
 * `CONTENT_CSP` already allows exactly this host pair for the screens agents
 * write — so Google Fonts' stylesheet and files load on localhost and on a
 * hosted home alike.
 *
 * What that costs is written down, as the Caveat and Inter notes in
 * `index.html` wrote theirs: a canvas that uses one of these tells Google that
 * somebody is looking, and offline the words fall back to the font's face —
 * still a serif, still monospace (`TEXT_FONTS` in core). A canvas that names
 * no font fetches nothing, and Inter, which this app already serves from
 * `/fonts`, is never fetched from anywhere else.
 *
 * `display=swap`, so a node never waits on a file; the box was sized for the
 * wider of the family and its fallback, so the swap does not clip it.
 */
const asked = new Set<string>(["Inter"]);

/** Ask for this family's file once per page; a no-op for null and for Inter. */
export function loadTextFont(font: TextFont | null): void {
  if (!font || asked.has(font.name)) return;
  asked.add(font.name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.name.replace(/ /g, "+")}:wght@400;700&display=swap`;
  document.head.append(link);
}
