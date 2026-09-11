import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { mimeFor } from "./mime.ts";

/**
 * Resolves a local reference string (from src=, poster=, url()) against the HTML file directory.
 * If the reference points to an existing local image file, returns a base64 data URI.
 * Otherwise returns null.
 */
export async function resolveImageToDataUri(
  rawRef: string,
  baseDir: string,
): Promise<string | null> {
  if (!rawRef) return null;
  const trimmed = rawRef.trim();

  // Skip remote URLs, existing data/blob URIs, protocol-relative URLs, and anchors
  if (
    trimmed.startsWith("data:") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("#")
  ) {
    return null;
  }

  const clean = trimmed.split(/[?#]/)[0] ?? "";
  let unescaped = clean;
  try {
    unescaped = decodeURIComponent(clean);
  } catch {
    // keep clean if malformed URI encoding
  }

  const candidates: string[] = [];
  if (path.isAbsolute(unescaped)) {
    candidates.push(unescaped);
    candidates.push(path.resolve(baseDir, "." + unescaped));
  } else {
    candidates.push(path.resolve(baseDir, unescaped));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isFile()) {
          const mime = mimeFor(candidate);
          if (mime.startsWith("image/")) {
            const data = await fs.readFile(candidate);
            return `data:${mime};base64,${data.toString("base64")}`;
          }
        }
      } catch {
        // ignore read error and try next candidate
      }
    }
  }

  return null;
}

/**
 * Inlines local CSS url(...) references within a stylesheet string.
 */
export async function inlineCssUrls(css: string, baseDir: string): Promise<string> {
  const urlRegex = /\burl\(\s*(["']?)(.*?)\1\s*\)/gi;
  const refsToReplace = new Map<string, string>();
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(css)) !== null) {
    const rawRef = match[2];
    if (rawRef && !refsToReplace.has(rawRef)) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        refsToReplace.set(rawRef, dataUri);
      }
    }
  }

  if (refsToReplace.size === 0) return css;

  return css.replace(
    /\burl\(\s*(["']?)(.*?)\1\s*\)/gi,
    (full, quote, ref) => {
      const dataUri = refsToReplace.get(ref);
      return dataUri ? `url("${dataUri}")` : full;
    },
  );
}

/**
 * Inlines all local filesystem assets referenced in an HTML document:
 * 1. Images and media in <img>, <source>, <video>, CSS url()
 * 2. Local stylesheets in <link rel="stylesheet">
 * 3. Local scripts in <script src="...">
 */
export async function inlineHtmlAssets(
  filePath: string,
  html: string,
): Promise<string> {
  const baseDir = path.dirname(path.resolve(filePath));

  // 1. Inline local stylesheets: <link ... rel="stylesheet" ... href="...">
  const linkRegex = /<link\b(?=[^>]*?\brel=["']stylesheet["'])(?=[^>]*?\bhref=["']([^"']+)["'])[^>]*>/gi;
  const linksToReplace = new Map<string, string>();
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = linkRegex.exec(html)) !== null) {
    const fullTag = linkMatch[0];
    const hrefMatch = /\bhref=["']([^"']+)["']/i.exec(fullTag);
    if (hrefMatch && hrefMatch[1]) {
      const rawHref = hrefMatch[1].trim();
      if (!rawHref.startsWith("http:") && !rawHref.startsWith("https:") && !rawHref.startsWith("//")) {
        const clean = rawHref.split(/[?#]/)[0];
        if (clean) {
          const cssPath = path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
          if (existsSync(cssPath)) {
            try {
              const rawCss = await fs.readFile(cssPath, "utf8");
              const inlinedCss = await inlineCssUrls(rawCss, path.dirname(cssPath));
              linksToReplace.set(fullTag, `<style>/* inlined: ${rawHref} */\n${inlinedCss}\n</style>`);
            } catch {
              // keep link as-is on error
            }
          }
        }
      }
    }
  }

  let result = html;
  for (const [tag, replacement] of linksToReplace.entries()) {
    result = result.replace(tag, replacement);
  }

  // 2. Inline local scripts: <script ... src="local.js"></script>
  const scriptRegex = /<script\b(?=[^>]*?\bsrc=["']([^"']+)["'])[^>]*>\s*<\/script>/gi;
  const scriptsToReplace = new Map<string, string>();
  let scriptMatch: RegExpExecArray | null;

  while ((scriptMatch = scriptRegex.exec(result)) !== null) {
    const fullTag = scriptMatch[0];
    const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(fullTag);
    if (srcMatch && srcMatch[1]) {
      const rawSrc = srcMatch[1].trim();
      if (!rawSrc.startsWith("http:") && !rawSrc.startsWith("https:") && !rawSrc.startsWith("//")) {
        const clean = rawSrc.split(/[?#]/)[0];
        if (clean) {
          const jsPath = path.isAbsolute(clean) ? clean : path.resolve(baseDir, clean);
          if (existsSync(jsPath)) {
            try {
              const rawJs = await fs.readFile(jsPath, "utf8");
              scriptsToReplace.set(fullTag, `<script>/* inlined: ${rawSrc} */\n${rawJs}\n</script>`);
            } catch {
              // keep script as-is on error
            }
          }
        }
      }
    }
  }

  for (const [tag, replacement] of scriptsToReplace.entries()) {
    result = result.replace(tag, replacement);
  }

  // 3. Collect all unique image/media references
  const refsToReplace = new Map<string, string>();

  // Match src= and poster= attributes
  const attrRegex = /\b(?:src|poster)=(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(result)) !== null) {
    const rawRef = match[2];
    if (rawRef && !refsToReplace.has(rawRef)) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        refsToReplace.set(rawRef, dataUri);
      }
    }
  }

  // Match CSS url(...) in style attributes and <style> tags
  const urlRegex = /\burl\(\s*(["']?)(.*?)\1\s*\)/gi;
  while ((match = urlRegex.exec(result)) !== null) {
    const rawRef = match[2];
    if (rawRef && !refsToReplace.has(rawRef)) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        refsToReplace.set(rawRef, dataUri);
      }
    }
  }

  // Match string literals referencing local image files (e.g. in JavaScript objects, React state, arrays)
  const jsImageRegex = /(["'`])([^"'`\n\r]+\.(?:png|jpg|jpeg|webp|svg|gif|avif))(?:\?[^"'`\n\r]*)?\1/gi;
  while ((match = jsImageRegex.exec(result)) !== null) {
    const rawRef = match[2];
    if (rawRef && !refsToReplace.has(rawRef)) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        refsToReplace.set(rawRef, dataUri);
      }
    }
  }

  if (refsToReplace.size > 0) {
    result = result.replace(
      /\b(src|poster)=(["'])(.*?)\2/gi,
      (full, attr, quote, ref) => {
        const dataUri = refsToReplace.get(ref);
        return dataUri ? `${attr}=${quote}${dataUri}${quote}` : full;
      },
    );

    result = result.replace(
      /\burl\(\s*(["']?)(.*?)\1\s*\)/gi,
      (full, quote, ref) => {
        const dataUri = refsToReplace.get(ref);
        return dataUri ? `url("${dataUri}")` : full;
      },
    );

    result = result.replace(
      /(["'`])([^"'`\n\r]+\.(?:png|jpg|jpeg|webp|svg|gif|avif))(?:\?[^"'`\n\r]*)?\1/gi,
      (full, quote, ref) => {
        const dataUri = refsToReplace.get(ref);
        return dataUri ? `${quote}${dataUri}${quote}` : full;
      },
    );
  }

  return result;
}

/**
 * Bundle the images the Markdown renderer actually paints, preserving the source
 * around them. Parsing avoids rewriting code, escaped examples or balanced URL
 * parentheses. Raw HTML is literal text in our renderer, so inlining it would
 * expose a base64 payload as prose. File links stay links to saved canvas files.
 */
export async function inlineMarkdownAssets(filePath: string, markdown: string): Promise<string> {
  const [{ unified }, { default: remarkParse }] = await Promise.all([import("unified"), import("remark-parse")]);
  type Node = { type: string; url?: string; alt?: string; title?: string | null; identifier?: string; children?: Node[];
    position?: { start: { offset?: number }; end: { offset?: number } } };
  const tree = unified().use(remarkParse).parse(markdown) as Node;
  const images: Node[] = [];
  const definitions = new Map<string, Node>();
  const walk = (node: Node) => {
    if (node.type === "definition" && node.identifier && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
    if (node.type === "image" || node.type === "imageReference") images.push(node);
    node.children?.forEach(walk);
  };
  walk(tree);
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const node of images) {
    const target = node.type === "imageReference" ? definitions.get(node.identifier ?? "") : node;
    const start = node.position?.start.offset, end = node.position?.end.offset;
    if (!target?.url || start === undefined || end === undefined) continue;
    const data = await resolveImageToDataUri(target.url, path.dirname(path.resolve(filePath)));
    if (!data) continue;
    const alt = (node.alt ?? "").replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
    const title = target.title == null ? "" : ` "${target.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const angle = /\]\(\s*</.test(markdown.slice(start, end));
    replacements.push({ start, end, text: `![${alt}](${angle ? `<${data}>` : data}${title})` });
  }
  let result = markdown;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
  return result;
}
