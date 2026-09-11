import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { inlineHtmlAssets, inlineMarkdownAssets } from "../src/inline.ts";

describe("inlineHtmlAssets", () => {
  it("inlines local images, css files, and scripts while preserving remotes", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inline-test-"));
    const imgPath = path.join(tmpDir, "test.png");
    // Minimal 1x1 PNG
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await fs.writeFile(imgPath, pngBytes);

    const cssPath = path.join(tmpDir, "styles.css");
    await fs.writeFile(cssPath, "body { background: url(\x27test.png\x27); color: red; }");

    const jsPath = path.join(tmpDir, "app.js");
    await fs.writeFile(jsPath, "console.log(\"hello from app.js\");");

    const htmlPath = path.join(tmpDir, "index.html");
    const html = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="styles.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto">
  <script src="app.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <img src="test.png" alt="Relative">
  <img src="${imgPath}" alt="Absolute">
  <img src="https://example.com/remote.png" alt="Remote">
  <img src="missing.png" alt="Missing">
  <div style="background-image: url(test.png)"></div>
</body>
</html>`;

    const inlined = await inlineHtmlAssets(htmlPath, html);

    // 1. Remote links should remain intact
    expect(inlined).toContain("href=\"https://fonts.googleapis.com/css?family=Roboto\"");
    expect(inlined).toContain("src=\"https://cdn.tailwindcss.com\"");
    expect(inlined).toContain("src=\"https://example.com/remote.png\"");

    // 2. Missing assets remain untouched
    expect(inlined).toContain("src=\"missing.png\"");

    // 3. Local CSS is inlined and its url(...) is inlined
    expect(inlined).toContain("<style>/* inlined: styles.css */");
    expect(inlined).toContain("data:image/png;base64,");

    // 4. Local JS is inlined
    expect(inlined).toContain("<script>/* inlined: app.js */");
    expect(inlined).toContain("console.log(\"hello from app.js\");");

    // 5. Local images are inlined as data URIs
    expect(inlined).toContain("src=\"data:image/png;base64,");
    expect(inlined).not.toContain("src=\"test.png\"");
    expect(inlined).not.toContain(`src="${imgPath}"`);

    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("handles html without local assets gracefully", async () => {
    const html = `<div>Hello world</div>`;
    const inlined = await inlineHtmlAssets("/tmp/nonexistent.html", html);
    expect(inlined).toBe(html);
  });

  it("inlines images referenced inside JavaScript strings and objects", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inline-js-test-"));
    const imgPath = path.join(tmpDir, "photo.jpg");
    const jpgBytes = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64",
    );
    await fs.writeFile(imgPath, jpgBytes);

    const htmlPath = path.join(tmpDir, "spa.html");
    const html = `<!DOCTYPE html>
<html>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const IMAGES = {
      hero: "photo.jpg",
      absolute: "${imgPath}",
      remote: "https://example.com/ext.jpg",
      missing: "missing.jpg",
    };
  </script>
</body>
</html>`;

    const inlined = await inlineHtmlAssets(htmlPath, html);
    expect(inlined).toContain('hero: "data:image/jpeg;base64,');
    expect(inlined).toContain('absolute: "data:image/jpeg;base64,');
    expect(inlined).toContain('remote: "https://example.com/ext.jpg"');
    expect(inlined).toContain('missing: "missing.jpg"');

    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
});

describe("inlineMarkdownAssets", () => {
  it("inlines local images in markdown while preserving code blocks and remotes", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "inline-md-test-"));
    const imgPath = path.join(tmpDir, "sample.png");
    const pngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );
    await fs.writeFile(imgPath, pngBytes);

    const mdPath = path.join(tmpDir, "doc.md");
    const md = `# Document Title

Here is a relative image:
![Relative Sample](sample.png)

Here is an absolute image:
![Absolute Sample](${imgPath})

Here is an image with title:
![With Title](sample.png "Art Direction Sample")

Here is an image with angle brackets:
![Angle Brackets](<sample.png>)

Here is an HTML image tag:
<img src="sample.png" alt="HTML Tag" width="300" />

Here is a reference image:
![Reference Tag][ref1]

[ref1]: sample.png "Reference Title"

Here is a direct image link:
[Direct Link to Image](sample.png)

Here is a link to non-image (should NOT be converted to data uri):
[Read Docs](readme.md)

Here is a remote image (should NOT be inlined):
![Remote Image](https://example.com/photo.png)

Here is a missing image (should remain untouched):
![Missing Image](missing.png)

\`\`\`markdown
Code block should be untouched:
![Code Image](sample.png)
\`\`\`

Inline code should also be untouched: \`![Inline Code](sample.png)\`.
`;

    const inlined = await inlineMarkdownAssets(mdPath, md);

    // 1. Relative, absolute, titled, and angle-bracketed images are inlined
    expect(inlined).toContain("![Relative Sample](data:image/png;base64,");
    expect(inlined).toContain(`![Absolute Sample](data:image/png;base64,`);
    expect(inlined).toContain("![With Title](data:image/png;base64,");
    expect(inlined).toContain('"Art Direction Sample")');
    expect(inlined).toContain("![Angle Brackets](<data:image/png;base64,");

    // 2. Raw HTML stays literal, as the renderer displays it.
    expect(inlined).toContain('<img src="sample.png"');

    // 3. Reference images get a self-contained destination; shared definitions stay intact.
    expect(inlined).toContain("![Reference Tag](data:image/png;base64,");
    expect(inlined).toContain('[ref1]: sample.png "Reference Title"');
    expect(inlined).toContain('"Reference Title"');

    // 4. File links remain addressable links, not blocked data-URI navigation.
    expect(inlined).toContain("[Direct Link to Image](sample.png)");

    // 5. Non-image links are preserved
    expect(inlined).toContain("[Read Docs](readme.md)");

    // 6. Remote and missing images are preserved
    expect(inlined).toContain("![Remote Image](https://example.com/photo.png)");
    expect(inlined).toContain("![Missing Image](missing.png)");

    // 7. Code blocks and inline code are completely preserved
    expect(inlined).toContain("![Code Image](sample.png)");
    expect(inlined).toContain("`![Inline Code](sample.png)`");

    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("handles balanced image paths and escaped examples without regex masking", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "inline-md-parsed-"));
    try {
      await fs.writeFile(path.join(dir, "plot(1).png"), Buffer.from("synthetic"));
      const source = "![Plot](plot(1).png)\n\n\\![Example](plot(1).png)\n\n    ![Code](plot(1).png)";
      const result = await inlineMarkdownAssets(path.join(dir, "doc.md"), source);
      expect(result).toContain("![Plot](data:image/png;base64,");
      expect(result).toContain("\\![Example](plot(1).png)");
      expect(result).toContain("    ![Code](plot(1).png)");
    } finally { await fs.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); }
  });

  it("handles markdown without images gracefully", async () => {
    const md = `# Plain Markdown\n\nNo images here.`;
    const inlined = await inlineMarkdownAssets("/tmp/test.md", md);
    expect(inlined).toBe(md);
  });
});
