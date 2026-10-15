/** The picture's stand-ins for `<html>` and `<body>`: inside an SVG's
 *  foreignObject the document is two `div`s, so rules the page wrote for
 *  `html`, `:root` and `body` are pointed at these instead — a slide's
 *  background is usually on one of them. */
const SNAP_ROOT = "isocan-snap-root";
const SNAP_BODY = "isocan-snap-body";

/**
 * A picture is one instant, and the instant it is drawn at is the first: an
 * entrance animation (`opacity: 0` → 1, `forwards`) would be drawn before it
 * starts, which is a slide with its words missing (Dion, 14 Oct 2026: a deck
 * whose title and card fade in drew as its background alone). So every
 * animation is drawn as it ends and every transition as already done. A page
 * that reveals itself from a script still draws unrevealed; nothing here runs
 * scripts.
 */
const SETTLED_CSS = `.${SNAP_ROOT}, .${SNAP_ROOT} *, .${SNAP_ROOT} *::before, .${SNAP_ROOT} *::after {
  animation-delay: 0s !important; animation-duration: 0s !important;
  animation-iteration-count: 1 !important; animation-fill-mode: forwards !important;
  transition: none !important;
}`;

/** A page's CSS with its `html` / `:root` / `body` selectors aimed at the picture's stand-ins. Only selectors change — declarations and at-rule preludes are left as written. */
function asPictureCss(css: string): string {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let at = 0;
  for (const match of text.matchAll(/[{}]/g)) {
    const end = match.index;
    const chunk = text.slice(at, end);
    if (match[0] === "{") {
      // The text since the last brace is a prelude only if it does not hold a
      // declaration's `;` — inside a block that does, the prelude follows it.
      const cut = chunk.lastIndexOf(";") + 1;
      const head = chunk.slice(0, cut);
      const prelude = chunk.slice(cut);
      out += head + (prelude.trim().startsWith("@") ? prelude : retarget(prelude)) + "{";
    } else {
      out += chunk + "}";
    }
    at = end + 1;
  }
  return out + text.slice(at);
}

function retarget(selector: string): string {
  return selector
    .replace(/:root(?![-\w])/g, `.${SNAP_ROOT}`)
    .replace(/(?<![-\w.#:])html(?![-\w])/g, `.${SNAP_ROOT}`)
    .replace(/(?<![-\w.#:])body(?![-\w])/g, `.${SNAP_BODY}`);
}

/** An HTML document as a still SVG picture: scripts, frames, linked stylesheets and remote `url(…)` references removed, so drawing it fetches and runs nothing. */
export function sanitizeDocumentToSvg(html: string, width: number, height: number): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const el of doc.querySelectorAll("script, noscript, iframe, object, embed, link[rel='stylesheet']")) {
    el.remove();
  }
  for (const style of doc.querySelectorAll("style")) {
    if (style.textContent) {
      style.textContent = style.textContent.replace(/url\(\s*['"]?https?:[^)]+\)/gi, "none");
    }
  }
  for (const el of doc.querySelectorAll("*")) {
    const inlineStyle = el.getAttribute("style");
    if (inlineStyle && /url\(\s*['"]?https?:/i.test(inlineStyle)) {
      el.setAttribute("style", inlineStyle.replace(/url\(\s*['"]?https?:[^)]+\)/gi, "none"));
    }
    if (el instanceof HTMLImageElement) {
      const src = el.getAttribute("src") ?? "";
      if (src && !src.startsWith("data:")) el.removeAttribute("src");
    }
  }

  const xhtml = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  xhtml.setAttribute("class", SNAP_ROOT);
  xhtml.setAttribute(
    "style",
    `width:${width}px;height:${height}px;overflow:hidden;position:relative;box-sizing:border-box;`,
  );
  // White only where the page says nothing: first, so the page's own `html`
  // rule (rewritten below) comes later and wins. Inline, it would beat it.
  const ground = doc.createElement("style");
  ground.textContent = `.${SNAP_ROOT}{background:#ffffff}`;
  xhtml.appendChild(ground);
  for (const style of doc.querySelectorAll("style")) {
    const copy = style.cloneNode(true) as HTMLStyleElement;
    copy.textContent = asPictureCss(style.textContent ?? "");
    xhtml.appendChild(copy);
  }
  const settled = doc.createElement("style");
  settled.textContent = SETTLED_CSS;
  xhtml.appendChild(settled);
  const bodyWrap = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
  for (const attr of doc.body.attributes) {
    if (attr.name === "class" || attr.name === "style" || attr.name.startsWith("data-")) {
      bodyWrap.setAttribute(attr.name, attr.value);
    }
  }
  bodyWrap.setAttribute("class", `${bodyWrap.getAttribute("class") ?? ""} ${SNAP_BODY}`.trim());
  bodyWrap.innerHTML = doc.body.innerHTML;
  for (const style of bodyWrap.querySelectorAll("style")) style.remove();
  xhtml.appendChild(bodyWrap);

  const serializer = new XMLSerializer();
  const serializedBody = serializer.serializeToString(xhtml);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${serializedBody}</foreignObject></svg>`;
}
