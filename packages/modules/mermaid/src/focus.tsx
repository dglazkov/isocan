import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  newGroupId,
  newVersionId,
  type FocusFacts,
  type RendererFacts,
} from "@isocan/core";
import { MERMAID_MIME } from "./core.ts";

const Diagram = lazy(() => import("./diagram.tsx"));

function DiagramView(facts: RendererFacts) {
  return (
    <Suspense fallback={<div className="file-view">{facts.filename}</div>}>
      <Diagram {...facts} />
    </Suspense>
  );
}

export interface MermaidNodeEntry {
  id: string;
  label: string;
}

/**
 * Extract addressable Mermaid node ids and labels from Mermaid DSL source
 * without loading the Mermaid runtime.
 */
export function extractMermaidNodes(dsl: string): MermaidNodeEntry[] {
  const seen = new Map<string, string>();
  const bracketRe = /\b([A-Za-z_][A-Za-z0-9_-]*)\s*(?:\[\s*"?([^"\]\n]+)"?\s*\]|\(\s*"?([^")\n]+)"?\s*\)|\{\s*"?([^"}\n]+)"?\s*\})/g;
  let m: RegExpExecArray | null;
  while ((m = bracketRe.exec(dsl)) !== null) {
    const id = m[1]!;
    const label = (m[2] ?? m[3] ?? m[4] ?? id).trim();
    if (!seen.has(id)) seen.set(id, label);
  }
  const edgeRe = /\b([A-Za-z_][A-Za-z0-9_-]*)\s*(?:-->|---|-\.->|==>)\s*(?:\|[^|]*\|\s*)?([A-Za-z_][A-Za-z0-9_-]*)\b/g;
  while ((m = edgeRe.exec(dsl)) !== null) {
    for (const id of [m[1]!, m[2]!]) {
      if (!seen.has(id)) seen.set(id, id);
    }
  }
  return [...seen.entries()].map(([id, label]) => ({ id, label }));
}

/**
 * Rename a node's bracketed label (`id[Old]` → `id["New"]`) or append a
 * declaration when the node was only named bare on an edge.
 */
export function renameMermaidNodeLabel(
  dsl: string,
  nodeId: string,
  newLabel: string,
): string {
  const escapedId = nodeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const safeLabel = newLabel.replace(/"/g, "'");
  const declRe = new RegExp(
    `(\\b${escapedId}\\s*)(?:\\[\\s*"?[^"\\]\\n]*"?\\s*\\]|\\(\\s*"?[^")\\n]*"?\\s*\\)|\\{\\s*"?[^"}\\n]*"?\\s*\\})`,
  );
  if (declRe.test(dsl)) {
    return dsl.replace(declRe, `$1["${safeLabel}"]`);
  }
  return `${dsl.trimEnd()}\n  ${nodeId}["${safeLabel}"]\n`;
}

export function MermaidFocusView(facts: FocusFacts) {
  const [dsl, setDsl] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [search, setSearch] = useState<string>("");
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((t) => {
        if (active) setDsl(t);
      })
      .catch(() => {
        if (active) setDsl("");
      });
    return () => {
      active = false;
    };
  }, [facts, facts.version.blobHash]);

  const nodes = useMemo(() => extractMermaidNodes(dsl), [dsl]);
  const filteredNodes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q),
    );
  }, [nodes, search]);

  return (
    <div className="mermaid-focus-view" data-testid="mermaid-focus-view">
      <div className="mermaid-focus-bar">
        <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}>
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}>
          +
        </button>
        <button type="button" onClick={() => setZoom(1)}>
          1:1
        </button>
        <input
          type="search"
          aria-label="Search diagram nodes"
          placeholder="Search nodes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span>{filteredNodes.length} nodes</span>
      </div>
      <div
        className="mermaid-focus-stage"
        style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
      >
        <DiagramView
          canvasId={facts.canvasId}
          entered={true}
          url=""
          blobHash={facts.version.blobHash}
          mimeType={facts.version.mimeType}
          filename={facts.version.filename}
          readText={facts.readText}
        />
      </div>
    </div>
  );
}

export function MermaidFocusEdit(facts: FocusFacts) {
  const [initialDsl, setInitialDsl] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const readTextRef = useRef(facts.readText);
  readTextRef.current = facts.readText;

  useEffect(() => {
    let active = true;
    void readTextRef
      .current()
      .then((t) => {
        if (!active) return;
        setInitialDsl(t);
        setDraft(t);
      })
      .catch(() => {
        if (active) setInitialDsl("");
      });
    return () => {
      active = false;
    };
  }, [facts, facts.version.blobHash]);

  const nodes = useMemo(() => extractMermaidNodes(draft), [draft]);
  const dirty = initialDsl !== null && draft !== initialDsl;

  if (initialDsl === null) {
    return <div className="page-note">Loading diagram studio…</div>;
  }

  const selectNode = (node: MermaidNodeEntry) => {
    facts.setSubtarget({
      kind: "mermaid-node",
      id: node.id,
      label: `Node: ${node.label} (${node.id})`,
      metadata: { nodeId: node.id, label: node.label },
    });
  };

  const onSave = async () => {
    if (!facts.canEdit || saving || !dirty) return;
    setSaving(true);
    try {
      const filename = facts.version.filename || "diagram.mmd";
      const uploaded = await facts.host.putBlob(
        new Blob([draft], { type: MERMAID_MIME }),
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
              mimeType: MERMAID_MIME,
              filename,
              size: uploaded.size,
            },
          },
        ],
        newGroupId(),
      );
      setInitialDsl(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mermaid-focus-edit" data-testid="mermaid-focus-edit">
      <div className="mermaid-focus-bar">
        <span>{nodes.length} diagram nodes</span>
        <span className="spacer" />
        <button
          type="button"
          disabled={!facts.canEdit || saving || !dirty}
          onClick={() => void onSave()}
        >
          {saving ? "Saving…" : dirty ? "Stack Diagram Version" : "Saved"}
        </button>
      </div>
      <div className="mermaid-focus-body">
        <div className="mermaid-focus-stage">
          <DiagramView
            canvasId={facts.canvasId}
            entered={true}
            url=""
            blobHash={`${facts.version.blobHash}:${draft.length}`}
            mimeType={MERMAID_MIME}
            filename={facts.version.filename}
            readText={async () => draft}
          />
        </div>
        <aside className="mermaid-focus-inspector" aria-label="Diagram node inspector">
          <strong>Nodes ({nodes.length})</strong>
          <ul>
            {nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  data-mermaid-node={node.id}
                  onClick={() => selectNode(node)}
                >
                  <code>{node.id}</code> · {node.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
