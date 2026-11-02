import { useEffect, useState } from "react";
import type {
  FocusFacts,
  InspectorFacts,
  PageFacts,
} from "@isocan/core";
import { newGroupId, newVersionId, workbenchItemPath } from "@isocan/core";
import {
  documentsOn,
  outlineOf,
  readingMinutes,
  wordCount,
  type Heading,
} from "./core.ts";

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
 * the line it starts on, and the document's size above them.
 */
export function DocumentOutline({ item, readText }: InspectorFacts) {
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
 */
export function DocumentsPage({ canvasId, canvas }: PageFacts) {
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

/**
 * Move the Markdown section starting at `headings[headingIndex]` up (`delta = -1`)
 * or down (`delta = 1`) relative to its neighbor section, returning updated Markdown.
 */
export function reorderMarkdownSection(
  markdown: string,
  headingIndex: number,
  delta: -1 | 1,
): string {
  const headings = outlineOf(markdown);
  const targetIdx = headingIndex + delta;
  if (headingIndex < 0 || headingIndex >= headings.length) return markdown;
  if (targetIdx < 0 || targetIdx >= headings.length) return markdown;

  const lines = markdown.split("\n");
  const bounds = headings.map((h, i) => {
    const start = h.line - 1;
    const end = i + 1 < headings.length ? headings[i + 1]!.line - 1 : lines.length;
    return { start, end };
  });

  const firstIdx = Math.min(headingIndex, targetIdx);
  const secondIdx = Math.max(headingIndex, targetIdx);
  const first = bounds[firstIdx]!;
  const second = bounds[secondIdx]!;

  const before = lines.slice(0, first.start);
  const blockA = lines.slice(first.start, first.end);
  const between = lines.slice(first.end, second.start);
  const blockB = lines.slice(second.start, second.end);
  const after = lines.slice(second.end);

  return [...before, ...blockB, ...between, ...blockA, ...after].join("\n");
}

export function DocumentFocusView(facts: FocusFacts) {
  const text = useDocumentText(facts.readText, facts.version.blobHash);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  if (text === null) {
    return <div className="page-note">Reading document…</div>;
  }

  const headings = outlineOf(text);
  const words = wordCount(text);

  return (
    <div className="doc-focus-view" data-testid="document-focus-view">
      <div className="doc-focus-bar">
        <span>
          <strong>{facts.item.title}</strong> · {words} words · ~{readingMinutes(words)} min read
        </span>
      </div>
      <div className="doc-focus-body">
        <article className="doc-focus-reader">
          {text.split("\n").map((line, idx) => {
            const lineNo = idx + 1;
            const heading = headings.find((h) => h.line === lineNo);
            if (heading) {
              return (
                <h3
                  key={lineNo}
                  data-heading-line={lineNo}
                  className={selectedLine === lineNo ? "doc-heading-active" : undefined}
                >
                  {heading.text}
                </h3>
              );
            }
            return line.trim() ? <p key={lineNo}>{line}</p> : <br key={lineNo} />;
          })}
        </article>
        <aside className="doc-focus-outline" aria-label="Document outline">
          <strong>Outline ({headings.length})</strong>
          {headings.length === 0 ? (
            <p className="doc-quiet">No ATX headings</p>
          ) : (
            <ol className="doc-headings">
              {headings.map((h) => (
                <li key={h.line}>
                  <button
                    type="button"
                    data-outline-jump={h.line}
                    onClick={() => setSelectedLine(h.line)}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </div>
  );
}

export function DocumentFocusEdit(facts: FocusFacts) {
  const initialText = useDocumentText(facts.readText, facts.version.blobHash);
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialText !== null) setDraft(initialText);
  }, [initialText]);

  if (draft === null) {
    return <div className="page-note">Loading document studio…</div>;
  }

  const headings = outlineOf(draft);
  const words = wordCount(draft);
  const dirty = initialText !== null && draft !== initialText;

  const selectSection = (h: Heading) => {
    facts.setSubtarget({
      kind: "doc-section",
      id: `line:${h.line}`,
      label: `Section: ${h.text}`,
      metadata: { line: h.line, level: h.level },
    });
  };

  const onMove = (index: number, delta: -1 | 1) => {
    setDraft(reorderMarkdownSection(draft, index, delta));
  };

  const onSave = async () => {
    if (!facts.canEdit || saving || !dirty) return;
    setSaving(true);
    try {
      const filename = facts.version.filename || "document.md";
      const uploaded = await facts.host.putBlob(
        new Blob([draft], { type: facts.version.mimeType }),
        filename,
      );
      await facts.host.send(
        [
          {
            type: "item.addVersion",
            itemId: facts.item.id,
            version: {
              id: newVersionId(),
              blobHash: uploaded.blobHash,
              mimeType: facts.version.mimeType,
              filename,
              size: uploaded.size,
            },
          },
        ],
        newGroupId(),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="doc-focus-edit" data-testid="document-focus-edit">
      <div className="doc-focus-bar">
        <span>
          {words} words · {headings.length} sections
        </span>
        <span className="spacer" />
        <button
          type="button"
          disabled={!facts.canEdit || saving || !dirty}
          onClick={() => void onSave()}
        >
          {saving ? "Saving…" : dirty ? "Stack Document Version" : "Saved"}
        </button>
      </div>
      <div className="doc-focus-body">
        <textarea
          className="doc-focus-editor"
          aria-label="Document markdown"
          disabled={!facts.canEdit}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <aside className="doc-focus-outline" aria-label="Outline section studio">
          <strong>Sections ({headings.length})</strong>
          <ol className="doc-headings">
            {headings.map((h, i) => (
              <li key={`${h.line}-${h.text}`} className="doc-section-row">
                <button
                  type="button"
                  data-doc-section={h.line}
                  onClick={() => selectSection(h)}
                >
                  {h.text}
                </button>
                <span className="doc-section-moves">
                  <button
                    type="button"
                    aria-label={`Move ${h.text} up`}
                    disabled={!facts.canEdit || i === 0}
                    onClick={() => onMove(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${h.text} down`}
                    disabled={!facts.canEdit || i === headings.length - 1}
                    onClick={() => onMove(i, 1)}
                  >
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}
