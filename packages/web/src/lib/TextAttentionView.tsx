import { useShallow } from "zustand/react/shallow";
import { memo, useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { actorColor, textAttention, TEXT_ATTENTION_MS } from "@isocan/core";
import type { TextAttention } from "@isocan/core";
import { publishTextSelection, useCanvasStore } from "../stores/canvasStore.ts";
import { rangeFromText, rangeToText } from "./text-range.ts";

/** Representation identity is supplied only for saved, addressable content.
 * Draft previews and Chat deliberately cannot publish document selections. */
export type AttentionDocument = Pick<TextAttention, "itemId" | "versionId" | "blobHash" | "flavor"> & { active: boolean };

/** A presence decoration around stable rendered children. Neither a roster
 * update nor a freshness tick reparses the Markdown document. */
export const TextAttentionView = memo(function TextAttentionView({ document: doc, children }: { document: AttentionDocument; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const sessions = useCanvasStore(useShallow(s => s.sessions.filter(session => session.textSelection?.itemId === doc.itemId)));
  const colors = useCanvasStore(useShallow(s => s.actorColors));
  const key = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [now, setNow] = useState(Date.now);
  const selectedHere = useRef(false);
  const [headings, setHeadings] = useState<HTMLElement[]>([]);
  useEffect(() => { setHeadings(Array.from(root.current?.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6") ?? [])); }, [children]);
  useEffect(() => {
    if (!doc.active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => { if (selectedHere.current) publishTextSelection(null, key); selectedHere.current = false; };
    const send = () => {
      timer = undefined;
      const range = !document.hidden && root.current ? rangeToText(root.current, window.getSelection()) : null;
      if (!range) return clear();
      selectedHere.current = true;
      publishTextSelection({ itemId: doc.itemId, versionId: doc.versionId, blobHash: doc.blobHash, flavor: doc.flavor,
        textSpace: "markdown-hast-v1", ...range, expiresAt: Date.now() + TEXT_ATTENTION_MS }, key);
    };
    const schedule = () => { if (!timer) timer = setTimeout(send, 100); };
    const final = () => { if (timer) clearTimeout(timer); send(); };
    document.addEventListener("selectionchange", schedule);
    document.addEventListener("pointerup", final);
    document.addEventListener("keyup", final);
    document.addEventListener("visibilitychange", final);
    const renew = setInterval(send, 5000);
    return () => {
      if (timer) clearTimeout(timer); clearInterval(renew); clear();
      document.removeEventListener("selectionchange", schedule);
      document.removeEventListener("pointerup", final);
      document.removeEventListener("keyup", final);
      document.removeEventListener("visibilitychange", final);
    };
  }, [doc.active, doc.itemId, doc.versionId, doc.blobHash, doc.flavor, key]);
  const interested = sessions.filter(s => s.textSelection?.itemId === doc.itemId);
  useEffect(() => {
    if (!interested.length) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [interested.length]);
  const live = interested.flatMap(s => {
    const range = textAttention(s.textSelection, Math.max(now, Date.now()));
    return range ? [{ session: s, range }] : [];
  });
  useEffect(() => {
    const registry = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    const HighlightRange = (globalThis as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight;
    if (!root.current || !registry || !HighlightRange) return;
    const style = document.createElement("style");
    const names: string[] = [];
    for (const { session, range: selected } of live) {
      if (selected.versionId !== doc.versionId || selected.blobHash !== doc.blobHash || selected.flavor !== doc.flavor) continue;
      const range = rangeFromText(root.current, selected.start, selected.end);
      if (!range) continue;
      const name = `attention${key}${names.length}`;
      names.push(name);
      registry.set(name, new HighlightRange(range));
      const color = actorColor(session.actor.id, colors);
      if (/^#[0-9a-f]{6}$/i.test(color)) style.textContent += `::highlight(${name}) { background-color: ${color}55; text-decoration: underline ${color}; }\n`;
    }
    document.head.append(style);
    return () => { for (const name of names) registry.delete(name); style.remove(); };
  });
  return <>
    {doc.active && headings.length > 1 && <details className="document-outline"><summary>Contents</summary><nav aria-label="Document headings">
      {headings.map(heading => <button type="button" className="btn quiet" key={heading.id} onClick={() => {
        const scroller = root.current?.closest(".md-view");
        if (!scroller) return;
        const scale = scroller.getBoundingClientRect().height / (scroller as HTMLElement).offsetHeight;
        scroller.scrollTop += (heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / scale;
      }}>{heading.textContent}</button>)}
    </nav></details>}
    {live.length > 0 && <div className="text-attention-status" aria-label="Shared text selections">
      {live.map(({ session, range }) => {
        const same = range.versionId === doc.versionId && range.blobHash === doc.blobHash && range.flavor === doc.flavor;
        return <span key={session.sessionId}>
          {session.actor.name} {same ? "is selecting text" : "is selecting in another version"}
          {same && <button type="button" className="btn quiet" onClick={() => {
            const selected = root.current && rangeFromText(root.current, range.start, range.end);
            const scroller = root.current?.closest(".md-view");
            if (selected && scroller) {
              const scale = scroller.getBoundingClientRect().height / (scroller as HTMLElement).offsetHeight;
              scroller.scrollTop += (selected.getBoundingClientRect().top - scroller.getBoundingClientRect().top) / scale - 55;
            }
          }}>Show selection</button>}
        </span>;
      })}
    </div>}
    <div ref={root} className="markdown-text" data-text-version={doc.versionId}>{children}</div>
  </>;
});
