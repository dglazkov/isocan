import { markdownResource, itemPath } from "@isocan/core";
import { useCanvasStore } from "../stores/canvasStore.ts";
import { blobUrl } from "./api.ts";
import { Link, useLocation } from "react-router-dom";
import { useEffect, useId, useMemo } from "react";
import type { Root, RootContent } from "hast";
import { TextAttentionView } from "./TextAttentionView.tsx";
import type { AttentionDocument } from "./TextAttentionView.tsx";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { PluggableList } from "unified";

/**
 * URL transform that permits image data URIs (data:image/...) in src attributes,
 * falling back to ReactMarkdown's default secure sanitizer for all other URLs.
 */
function safeUrlTransform(url: string, key: string): string {
  if (key === "src" && /^data:image\/(png|jpe?g|gif|webp|svg\+xml|avif|bmp|ico);base64,/i.test(url)) {
    return url;
  }
  return defaultUrlTransform(url);
}

/** Route-aware scrolling is only mounted for saved documents. Plain Markdown
 * (including static rendering of comments) does not require a router. */
function FragmentScroll({ active, prefix, source }: { active: boolean; prefix: string; source: string }) {
  const location = useLocation();
  useEffect(() => {
    if (!active || !location.hash) return;
    let fragment: string;
    try { fragment = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(`${prefix}-${fragment}`);
    const scroller = target?.closest<HTMLElement>(".md-view");
    if (target && scroller) scroller.scrollTop += (target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / (scroller.getBoundingClientRect().height / scroller.offsetHeight) - (parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0);
  }, [location.hash, active, source, prefix]);
  return null;
}

/**
 * **The markdown renderer, and everything it drags with it.**
 *
 * This module exists to be the far side of a `React.lazy` boundary — see
 * `markdown.tsx`, which is what everything else imports. Nothing else may
 * import `react-markdown`, `remark-gfm` or `remark-breaks`: one static import
 * anywhere else puts the whole micromark/mdast/hast stack back into the entry
 * chunk and the split silently stops working.
 *
 * That stack measured **~175 KB of a 758 KB entry chunk** on 1 Sep 2026 —
 * 23%, and the largest single thing in it after react-dom. The plugins have to
 * live on this side too: `remarkGfm` is a value, so importing it beside a lazy
 * renderer would keep `micromark-extension-gfm` eagerly loaded and leave the
 * boundary decorative. Callers pass `breaks` as a flag rather than passing
 * plugins in, for exactly that reason.
 */
export default function MarkdownBody({
  children,
  breaks = false,
  rehypePlugins,
  attention,
  plain = false,
}: {
  children: string;
  attention?: AttentionDocument | undefined;
  plain?: boolean | undefined;
  /** A single newline is a line break — for items whose text was typed as
   * prose rather than authored as markdown. `ItemView` explains the rule. */
  breaks?: boolean | undefined;
  rehypePlugins?: PluggableList | undefined;
}) {
  const canvas = useCanvasStore(s => attention ? s.canvas : null);
  const canvasId = useCanvasStore(s => attention ? s.canvasId : null);
  const resolve = (url: string) => {
    const source = attention && canvas?.items[attention.itemId];
    return source && canvas && attention ? markdownResource(canvas, source, attention.versionId, url) : null;
  };
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const headings = useMemo(() => () => (tree: Root) => {
    const seen = new Map<string, number>();
    const text = (node: Root | RootContent): string => "value" in node ? String(node.value) : "children" in node ? node.children.map(text).join("") : "";
    const walk = (node: Root | RootContent) => {
      if (node.type === "element" && /^h[1-6]$/.test(node.tagName)) {
        const slug = text(node).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
        const count = seen.get(slug) ?? 0; seen.set(slug, count + 1);
        node.properties.id = `${prefix}-${slug}${count ? `-${count}` : ""}`;
      }
      if ("children" in node) node.children.forEach(walk);
    };
    walk(tree);
  }, [prefix]);
  const content = plain ? <span style={{ whiteSpace: "pre-wrap" }}>{children}</span> : (
    <ReactMarkdown
      remarkPlugins={breaks ? [remarkGfm, remarkBreaks] : [remarkGfm]}
      urlTransform={safeUrlTransform}
      rehypePlugins={[headings, ...(rehypePlugins ?? [])]}
      components={{
        img: ({ node: _node, ...props }) => {
          if (!props.src || props.src.startsWith("data:")) return <img {...props} />;
          const resource = resolve(props.src);
          if (!resource || resource.kind === "external") return <img {...props} />;
          if (resource.kind === "item" && resource.mimeType.startsWith("image/") && canvasId) return <img {...props} src={blobUrl(canvasId, resource.blobHash)} />;
          return <img alt={props.alt} title={`Image unavailable on this canvas: ${props.src}`} className="markdown-resource-missing" />;
        },
        a: ({ node: _node, ...props }) => {
          const resource = props.href ? resolve(props.href) : null;
          if (resource?.kind === "item" && canvasId) return <Link {...props} to={`${itemPath(canvasId, resource.itemId)}${resource.fragment ? `#${resource.fragment}` : ""}`} />;
          if (resource && ["missing", "ambiguous", "unsafe"].includes(resource.kind)) return <span className="markdown-resource-missing" title={`${resource.kind === "ambiguous" ? "More than one saved file matches" : "File unavailable on this canvas"}: ${props.href}`}>{props.children}</span>;
          return <a {...props} onClick={event => {
        if (!props.href?.startsWith("#")) return;
        let fragment: string;
        try { fragment = decodeURIComponent(props.href.slice(1)); } catch { return; }
        const target = document.getElementById(`${prefix}-${fragment}`);
        const scroller = event.currentTarget.closest(".md-view");
        if (!target || !scroller) return;
        event.preventDefault();
        const scale = scroller.getBoundingClientRect().height / (scroller as HTMLElement).offsetHeight;
        scroller.scrollTop += (target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / scale - (parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0);
      }} />; } }}
    >
      {children}
    </ReactMarkdown>
  );
  return attention ? <><FragmentScroll active={attention.active} prefix={prefix} source={children} /><TextAttentionView document={attention}>{content}</TextAttentionView></> : content;
}
