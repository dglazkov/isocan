import { useEffect, useState, type ComponentType } from "react";
import type { InspectorFacts, PageFacts, RendererFacts, UnderlayFacts, WebModule } from "@isocan/core";
import { workbenchItemPath } from "@isocan/core";
import { documentsModule, documentsOn, outlineOf, readingMinutes, wordCount, type Heading } from "./core.ts";

/**
 * **The documents module's web half**: the outline beside the stage, and a
 * Documents page. Both read facts the shell hands them — the item and its
 * bytes, the canvas — and neither holds a store or a socket
 * (`docs/projects/modules/design.md`).
 */

function useDocumentText(readText: () => Promise<string>, key: string): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setText(null);
    readText()
      .then((t) => live && setText(t))
      .catch(() => live && setText(""));
    return () => {
      live = false;
    };
    // Keyed on the version, not on the function: the shell may hand a fresh
    // closure per render for the same bytes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return text;
}

function currentHash(item: InspectorFacts["item"]): string {
  return (item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions[0])?.blobHash ?? "";
}

/**
 * **The outline, beside the stage.** Headings indented by level, each with
 * the line it starts on, and the document's size above them. It reads; it
 * does not jump — the stage's markdown has no anchors to jump to yet, and a
 * click that did nothing would teach people the list is decoration.
 */
function DocumentOutline({ item, readText }: InspectorFacts) {
  const text = useDocumentText(readText, currentHash(item));
  if (text === null) return <div className="doc-outline"><p className="doc-quiet">Reading…</p></div>;
  const headings = outlineOf(text);
  const words = wordCount(text);
  return (
    <div className="doc-outline">
      <p className="doc-size">
        {words} words · about {readingMinutes(words)} min
      </p>
      {headings.length === 0 ? (
        <p className="doc-quiet">No headings. An agent can propose some: <code>/outline</code>.</p>
      ) : (
        <OutlineList headings={headings} />
      )}
    </div>
  );
}

function OutlineList({ headings }: { headings: readonly Heading[] }) {
  const top = Math.min(...headings.map((h) => h.level));
  return (
    <ol className="doc-headings">
      {headings.map((h) => (
        <li key={`${h.line}`} style={{ paddingLeft: `${(h.level - top) * 12}px` }} title={`line ${h.line}`}>
          {h.text}
        </li>
      ))}
    </ol>
  );
}

/**
 * **The Documents page**: every document on the canvas, newest edit first,
 * each with its size and its headings, opening on the workbench's stage.
 * A section of the app a module owns — the first use of the page slot.
 */
function DocumentsPage({ canvasId, canvas }: PageFacts) {
  const docs = documentsOn(canvas);
  if (docs.length === 0) {
    return (
      <div className="docs-page">
        <p className="doc-quiet">
          No documents on this canvas yet. Drop a <code>.md</code> file, or <code>isocan add notes.md</code>.
        </p>
      </div>
    );
  }
  return (
    <div className="docs-page">
      <ol className="docs-list">
        {docs.map((doc) => (
          <li key={doc.id} className="docs-row">
            <a href={workbenchItemPath(canvasId, doc.id)}>
              <b>{doc.title}</b>
              <small>
                {(doc.versions.find((v) => v.id === doc.currentVersionId) ?? doc.versions[0])?.filename} · v{doc.versions.length} ·{" "}
                {new Date(doc.updatedAt).toLocaleDateString()}
              </small>
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

export const documentsWeb: WebModule<
  ComponentType<UnderlayFacts>,
  ComponentType<RendererFacts>,
  ComponentType<InspectorFacts>,
  ComponentType<PageFacts>
> = {
  core: documentsModule,
  inspectors: [{ kinds: ["document"], label: "Outline", component: DocumentOutline }],
  pages: [{ segment: "docs", label: "Documents", hint: "every document on this canvas, with its shape", component: DocumentsPage }],
};

export default documentsWeb;
