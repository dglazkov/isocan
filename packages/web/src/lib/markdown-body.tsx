import { useId, useMemo } from "react";
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
      components={{ a: ({ node: _node, ...props }) => <a {...props} onClick={event => {
        if (!props.href?.startsWith("#")) return;
        let fragment: string;
        try { fragment = decodeURIComponent(props.href.slice(1)); } catch { return; }
        const target = document.getElementById(`${prefix}-${fragment}`);
        const scroller = event.currentTarget.closest(".md-view");
        if (!target || !scroller) return;
        event.preventDefault();
        const scale = scroller.getBoundingClientRect().height / (scroller as HTMLElement).offsetHeight;
        scroller.scrollTop += (target.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / scale;
      }} /> }}
    >
      {children}
    </ReactMarkdown>
  );
  return attention ? <TextAttentionView document={attention}>{content}</TextAttentionView> : content;
}
