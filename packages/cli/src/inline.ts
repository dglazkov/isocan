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
  }

  return result;
}

/**
 * Inlines all local filesystem image assets referenced in a Markdown document:
 * 1. Standard markdown images: ![alt](path "title"), ![alt](<path>)
 * 2. Inline HTML <img>, <source>, <video poster="..."> tags
 * 3. Markdown reference definitions: [ref]: path "title"
 * 4. Regular markdown links pointing to local image files: [alt](path.png)
 *
 * Ignores content inside fenced code blocks and inline code.
 */
export async function inlineMarkdownAssets(
  filePath: string,
  markdown: string,
): Promise<string> {
  const baseDir = path.dirname(path.resolve(filePath));

  // 1. Mask fenced code blocks and inline code so we don't alter code snippets
  const codeBlocks: string[] = [];
  const maskedMarkdown = markdown.replace(
    /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g,
    (match) => {
      const placeholder = `__ISOCAN_CODE_BLOCK_${codeBlocks.length}__`;
      codeBlocks.push(match);
      return placeholder;
    },
  );

  let result = maskedMarkdown;

  // 2. Handle HTML <img> and <source> tags
  const attrRegex = /\b(?:src|poster)=(["'])(.*?)\1/gi;
  const htmlRefsToReplace = new Map<string, string>();
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(result)) !== null) {
    const rawRef = attrMatch[2];
    if (rawRef && !htmlRefsToReplace.has(rawRef)) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        htmlRefsToReplace.set(rawRef, dataUri);
      }
    }
  }
  if (htmlRefsToReplace.size > 0) {
    result = result.replace(
      /\b(src|poster)=(["'])(.*?)\2/gi,
      (full, attr, quote, ref) => {
        const dataUri = htmlRefsToReplace.get(ref);
        return dataUri ? `${attr}=${quote}${dataUri}${quote}` : full;
      },
    );
  }

  // 3. Handle Markdown images: ![alt](target)
  const mdImageRegex = /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^"'\s\)]+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*\)/g;
  const mdImageReplacements: Array<{ fullMatch: string; replacement: string }> = [];
  let mdMatch: RegExpExecArray | null;

  while ((mdMatch = mdImageRegex.exec(result)) !== null) {
    const fullMatch = mdMatch[0];
    const alt = mdMatch[1];
    const isAngleBracket = Boolean(mdMatch[2]);
    const rawRef = mdMatch[2] ?? mdMatch[3];
    const title = mdMatch[4] ?? mdMatch[5] ?? mdMatch[6];

    if (rawRef) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        const dest = isAngleBracket ? `<${dataUri}>` : dataUri;
        let titleSuffix = "";
        if (title !== undefined) {
          titleSuffix = ` "${title.replace(/"/g, '\\"')}"`;
        }
        mdImageReplacements.push({
          fullMatch,
          replacement: `![${alt}](${dest}${titleSuffix})`,
        });
      }
    }
  }

  for (const { fullMatch, replacement } of mdImageReplacements) {
    result = result.replace(fullMatch, replacement);
  }

  // 4. Handle Reference definitions: [ref]: target "title"
  const refDefRegex = /^(\s*\[[^\]]+\]:\s*)(?:<([^>]+)>|(\S+))((?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*)$/gm;
  const refReplacements: Array<{ fullMatch: string; replacement: string }> = [];
  let refMatch: RegExpExecArray | null;

  while ((refMatch = refDefRegex.exec(result)) !== null) {
    const fullMatch = refMatch[0];
    const prefix = refMatch[1];
    const isAngleBracket = Boolean(refMatch[2]);
    const rawRef = refMatch[2] ?? refMatch[3];
    const suffix = refMatch[4];

    if (rawRef) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        const dest = isAngleBracket ? `<${dataUri}>` : dataUri;
        refReplacements.push({
          fullMatch,
          replacement: `${prefix}${dest}${suffix}`,
        });
      }
    }
  }

  for (const { fullMatch, replacement } of refReplacements) {
    result = result.replace(fullMatch, replacement);
  }

  // 5. Handle Markdown links pointing directly to local image files: [text](target)
  const mdLinkRegex = /(?<!!)\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^"'\s\)]+))(?:\s+(?:"([^"]*)"|'([^']*)'|\(([^)]*)\)))?\s*\)/g;
  const mdLinkReplacements: Array<{ fullMatch: string; replacement: string }> = [];
  let linkMatch: RegExpExecArray | null;

  while ((linkMatch = mdLinkRegex.exec(result)) !== null) {
    const fullMatch = linkMatch[0];
    const text = linkMatch[1];
    const isAngleBracket = Boolean(linkMatch[2]);
    const rawRef = linkMatch[2] ?? linkMatch[3];
    const title = linkMatch[4] ?? linkMatch[5] ?? linkMatch[6];

    if (rawRef) {
      const dataUri = await resolveImageToDataUri(rawRef, baseDir);
      if (dataUri) {
        const dest = isAngleBracket ? `<${dataUri}>` : dataUri;
        let titleSuffix = "";
        if (title !== undefined) {
          titleSuffix = ` "${title.replace(/"/g, '\\"')}"`;
        }
        mdLinkReplacements.push({
          fullMatch,
          replacement: `[${text}](${dest}${titleSuffix})`,
        });
      }
    }
  }

  for (const { fullMatch, replacement } of mdLinkReplacements) {
    result = result.replace(fullMatch, replacement);
  }

  // 6. Restore code blocks
  result = result.replace(
    /__ISOCAN_CODE_BLOCK_(\d+)__/g,
    (_, idx) => codeBlocks[Number(idx)] ?? "",
  );

  return result;
}

