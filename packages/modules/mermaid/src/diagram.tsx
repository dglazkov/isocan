import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { RendererFacts } from "@isocan/core";

/**
 * **One diagram, drawn from its text.**
 *
 * The library renders to an SVG string, which is what makes it fit here: the
 * picture is inert markup on the app's origin, not a script, and the source
 * of it is the file the item already is. `securityLevel: "strict"` is the
 * library's own sandbox for the text — no click handlers, no HTML labels —
 * and it stays strict because a diagram arrives from whoever put it on the
 * canvas.
 *
 * The theme follows the page: an explicit `data-theme` wins, then the
 * system, the same three states the app's own CSS handles. Re-rendered when
 * the bytes change (a new version) and when the theme does.
 */
let initialised = false;
function initOnce(dark: boolean) {
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: "inherit" });
  initialised = true;
}

function isDark(): boolean {
  const stamped = document.documentElement.dataset.theme;
  if (stamped === "dark") return true;
  if (stamped === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

let counter = 0;

export default function Diagram({ blobHash, filename, readText }: RendererFacts) {
  const [state, setState] = useState<{ svg: string } | { error: string } | null>(null);
  const [dark, setDark] = useState(isDark);
  // The work is keyed on the BYTES, not on the function that reads them: a
  // shell re-render that hands over a fresh `readText` for the same blob is
  // not a new diagram. Measured before this: every presence tick refetched
  // both blobs and redrew both pictures.
  const read = useRef(readText);
  read.current = readText;

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(isDark());
    media.addEventListener("change", update);
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      media.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const text = await read.current();
        // The theme is fixed at initialise time, so a theme change re-initialises.
        if (!initialised || dark !== lastDark) {
          initOnce(dark);
          lastDark = dark;
        }
        const { svg } = await mermaid.render(`isocan-diagram-${++counter}`, text);
        if (live) setState({ svg });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (live) setState({ error: message.split("\n")[0] ?? "could not draw this diagram" });
      }
    })();
    return () => {
      live = false;
    };
  }, [blobHash, dark]);

  if (state === null) return <div className="file-view">{filename}</div>;
  if ("error" in state) {
    return (
      <div className="file-view diagram-error">
        {filename}
        <br />
        <small>{state.error}</small>
      </div>
    );
  }
  return <div className="diagram-view" dangerouslySetInnerHTML={{ __html: state.svg }} />;
}

let lastDark: boolean | null = null;
