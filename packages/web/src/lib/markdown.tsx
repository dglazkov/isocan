import { lazy, Suspense } from "react";
import type { PluggableList } from "unified";

/**
 * **Markdown, off the critical path.**
 *
 * The markdown stack — micromark, mdast, hast, property-information and the
 * rest — measured **~175 KB of a 758 KB entry chunk** on 1 Sep 2026, against a
 * bound of 700 KB the `performance` persona had been reporting as MISSED for
 * three days. It is the largest thing in the bundle after react-dom, and it is
 * needed by four components, all of which have something true to show without
 * it: the text itself.
 *
 * **Why lazy and not `manualChunks`.** Splitting it into a second eager chunk
 * would take the LARGEST chunk under the bound while a first visit downloaded
 * exactly the same bytes — tuning the number rather than the thing, which is
 * the failure `scripts/grade.mjs` deliberately avoids by reporting counts
 * instead of a score. This removes it from the first download for real: a
 * route with no markdown on it never fetches the parser at all.
 *
 * **Why the fallback is the raw text.** It is the same words, unstyled, for
 * the frame the chunk takes — never a spinner and never blank. A reader whose
 * network is slow gets a readable comment rather than a placeholder, which is
 * the correct failure for a document viewer.
 *
 * **And why `preloadMarkdown` exists.** A canvas can hold fifty markdown
 * items, and fifty Suspense boundaries resolving one after another is a page
 * that jitters. The app asks for the chunk on idle as soon as it mounts, so in
 * practice it has landed before anybody scrolls to it and no boundary ever
 * shows its fallback. The laziness is for the DOWNLOAD; the preload is so the
 * user never pays for it.
 */
const MarkdownBody = lazy(() => import("./markdown-body.tsx"));

/** Fetch the markdown chunk without rendering anything. Safe to call more than
 * once — the module registry makes every call after the first a no-op. */
export function preloadMarkdown(): void {
  void import("./markdown-body.tsx");
}

export function Markdown({
  children,
  breaks = false,
  rehypePlugins,
}: {
  children: string;
  breaks?: boolean | undefined;
  rehypePlugins?: PluggableList | undefined;
}) {
  return (
    <Suspense
      fallback={
        // `pre-wrap` because the fallback must not reflow the block when the
        // real renderer replaces it any more than it has to: markdown's own
        // paragraphs collapse whitespace, and text that jumps twice is worse
        // than text that jumps once.
        <div className="md-pending" style={{ whiteSpace: "pre-wrap" }}>
          {children}
        </div>
      }
    >
      <MarkdownBody breaks={breaks} {...(rehypePlugins ? { rehypePlugins } : {})}>
        {children}
      </MarkdownBody>
    </Suspense>
  );
}
