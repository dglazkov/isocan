// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeDocumentToSvg } from "../src/lib/htmlsnapshot.ts";

describe("sanitizeDocumentToSvg", () => {
  it("preserves layout styles, body markup, and inline data URIs inside an SVG foreignObject", () => {
    const html = `<!doctype html><html><head><style>.card { background: #ffffff; padding: 16px; }</style></head><body class="dark"><div class="card"><h1>Acme Dashboard</h1><img src="data:image/png;base64,iVBORw0KGgo=" /></div></body></html>`;
    const svg = sanitizeDocumentToSvg(html, 880, 640);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="880" height="640"');
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain(".card { background: #ffffff; padding: 16px; }");
    expect(svg).toContain("Acme Dashboard");
    expect(svg).toContain('src="data:image/png;base64,iVBORw0KGgo="');
  });

  it("strips scripts, subframes, and external network URLs that would execute or taint canvas export", () => {
    const html = `<!doctype html><html><head><link rel="stylesheet" href="https://cdn.acme.test/app.css" /><style>.bg { background-image: url("https://cdn.acme.test/bg.png"); }</style></head><body><script>window.evil = 1;</script><iframe src="https://acme.test"></iframe><div style="background: url('https://cdn.acme.test/hero.jpg')"><img src="https://cdn.acme.test/photo.jpg" alt="Acme" /></div></body></html>`;
    const svg = sanitizeDocumentToSvg(html, 640, 480);
    expect(svg).not.toContain("<script");
    expect(svg).not.toContain("<iframe");
    expect(svg).not.toContain("<link");
    expect(svg).not.toContain("https://cdn.acme.test/bg.png");
    expect(svg).not.toContain("https://cdn.acme.test/hero.jpg");
    expect(svg).not.toContain('src="https://cdn.acme.test/photo.jpg"');
  });

  // Dion, 14 Oct 2026: a slide on the canvas drew as its background alone, and
  // a slide whose gradient is on `body` drew white. The picture is two divs,
  // so `html`/`body` rules matched nothing, and a fade-in was drawn at frame 0.
  it("aims html, :root and body rules at the picture's stand-ins, and leaves declarations as written", () => {
    const html = `<!doctype html><html><head><style>
      html, body { margin: 0 } /* body */
      :root { --ink: #222 }
      body.dark main { background: linear-gradient(135deg, #e9ece2, #f3e3da); font-family: body-font }
      @media (min-width: 10px) { body { color: var(--ink) } }
      .tbody, #body, .html-view { color: red }
    </style></head><body class="dark"><main>Acme</main></body></html>`;
    const svg = sanitizeDocumentToSvg(html, 1920, 1080);
    expect(svg).toContain(".isocan-snap-root, .isocan-snap-body { margin: 0 }");
    expect(svg).toContain(".isocan-snap-root { --ink: #222 }");
    expect(svg).toContain(".isocan-snap-body.dark main { background: linear-gradient(135deg, #e9ece2, #f3e3da); font-family: body-font }");
    expect(svg).toContain("@media (min-width: 10px) { .isocan-snap-body { color: var(--ink) } }");
    expect(svg).toContain(".tbody, #body, .html-view { color: red }");
    expect(svg).toMatch(/class="dark isocan-snap-body"/);
    // The page's `html` rule must be able to beat the white ground.
    expect(svg).not.toMatch(/style="[^"]*background/);
  });

  it("draws entrance animations as they end, not before they start", () => {
    const html = `<!doctype html><html><head><style>
      .reveal { opacity: 0; animation: rise .8s ease-out .2s forwards }
      @keyframes rise { to { opacity: 1 } }
    </style></head><body><h1 class="reveal">Acme</h1></body></html>`;
    const svg = sanitizeDocumentToSvg(html, 1920, 1080);
    expect(svg).toContain("@keyframes rise { to { opacity: 1 } }");
    expect(svg).toMatch(/animation-duration: 0s !important;[\s\S]*animation-fill-mode: forwards !important/);
  });
});
