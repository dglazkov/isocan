import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import type { PluggableList } from "unified";

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
}: {
  children: string;
  /** A single newline is a line break — for items whose text was typed as
   * prose rather than authored as markdown. `ItemView` explains the rule. */
  breaks?: boolean | undefined;
  rehypePlugins?: PluggableList | undefined;
}) {
  return (
    <ReactMarkdown
      remarkPlugins={breaks ? [remarkGfm, remarkBreaks] : [remarkGfm]}
      {...(rehypePlugins ? { rehypePlugins } : {})}
    >
      {children}
    </ReactMarkdown>
  );
}
