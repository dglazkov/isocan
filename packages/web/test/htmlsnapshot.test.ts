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
});
