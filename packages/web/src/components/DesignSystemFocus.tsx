import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  bySeverity,
  checkDesign,
  DESIGN_SURFACES,
  DESIGN_SYSTEM_ROLE,
  isDesignSystem,
  isWireframeScreen,
  itemKind,
  itemPath,
  newOpId,
  newVersionId,
  parseDesign,
  parseHex,
  resolveToken,
  selectGoverningDesign,
  serializeDesign,
  workbenchItemPath,
  type CanvasContents,
  type DesignDoc,
  type DesignTokens,
  type DesignTypography,
  type FocusFacts,
  type Item,
  type ItemVersion,
} from "@isocan/core";
import { auditScreen } from "@isocan/core/design-audit";
import { readDesignDirection, withDesignDirection } from "@isocan/core/design-direction";
import {
  prepareDesignReconciliation,
  projectDesignSystem,
  reconcileDesignProjection,
  type DesignProjection,
  type DesignReconcileResult,
  type DesignSystemPort,
} from "@isocan/api/design-system";
import { readBlobText } from "../lib/api.ts";
import { designSystemIO } from "../lib/design-system.ts";
import {
  directionFields,
  directionValue,
  type DirectionFields,
} from "../lib/design-system-draft.ts";
import {
  componentCss,
  componentShape,
  readableInk,
} from "../lib/designview.ts";
import { DesignSystemView } from "./DesignSystemView.tsx";
import type { FocusFacetRecord } from "../lib/focusRegistry.ts";

export interface GovernedScreenRow {
  itemId: string;
  title: string;
  status: "pass" | "warnings" | "loading";
  warningCount: number;
  onSystemCount: number;
  offSystemCount: number;
}

/**
 * Compute the **Governed Screens Matrix** across `canvas` for `designItem`:
 * finds every non-wireframe HTML screen governed by `designItem` and audits its
 * static styling against `tokens` using `@isocan/core`'s `auditScreen`.
 */
export function computeGovernedScreensMatrix(
  canvas: CanvasContents,
  designItem: Item,
  tokens: DesignTokens,
  screenSources: Readonly<Record<string, string>>,
): GovernedScreenRow[] {
  const screens = Object.values(canvas.items).filter(
    (other) =>
      other.id !== designItem.id &&
      itemKind(other) === "screen" &&
      !isWireframeScreen(other),
  );

  const governed = screens.filter((screen) => {
    const selected = selectGoverningDesign(canvas, [], { at: screen });
    return selected.item?.id === designItem.id;
  });

  return governed.map((screen) => {
    const html = screenSources[screen.id];
    if (html === undefined) {
      return {
        itemId: screen.id,
        title: screen.title || screen.id,
        status: "loading",
        warningCount: 0,
        onSystemCount: 0,
        offSystemCount: 0,
      };
    }
    const audit = auditScreen(html, tokens);
    const offSystemCount = audit.offSystem.reduce((sum, entry) => sum + entry.count, 0);
    const warningCount = audit.diagnostics.length;
    return {
      itemId: screen.id,
      title: screen.title || screen.id,
      status: warningCount === 0 ? "pass" : "warnings",
      warningCount,
      onSystemCount: audit.onSystem,
      offSystemCount,
    };
  });
}

export interface TokenStudioPatch {
  name?: string;
  description?: string;
  surface?: string;
  colors?: Record<string, string>;
  typography?: Record<string, DesignTypography>;
  spacing?: Record<string, string | number>;
  rounded?: Record<string, string>;
  components?: Record<string, Record<string, string>>;
  direction?: DirectionFields;
  body?: string;
}

/**
 * Pure helper applying structured Token & Direction Studio edits to a
 * `DESIGN.md` source string: updates `tokens` (and optional `direction` /
 * `body`), serializes back to canonical `DESIGN.md` Markdown, re-parses the
 * document so `{colors.*}` component references resolve live, and returns
 * `checkDesign(doc)` findings (including WCAG AA contrast warnings).
 */
export function applyTokenStudioPatch(
  baseMarkdown: string,
  patch: TokenStudioPatch,
): {
  text: string;
  doc: DesignDoc;
  findings: ReturnType<typeof checkDesign>;
} {
  const baseDoc = parseDesign(baseMarkdown);
  const nextTokens: DesignTokens = {
    ...baseDoc.tokens,
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.surface !== undefined ? { surface: patch.surface } : {}),
    ...(patch.colors !== undefined ? { colors: { ...patch.colors } } : {}),
    ...(patch.typography !== undefined ? { typography: { ...patch.typography } } : {}),
    ...(patch.spacing !== undefined ? { spacing: { ...patch.spacing } } : {}),
    ...(patch.rounded !== undefined ? { rounded: { ...patch.rounded } } : {}),
    ...(patch.components !== undefined ? { components: { ...patch.components } } : {}),
  };

  let workingDoc: DesignDoc = {
    ...baseDoc,
    tokens: nextTokens,
    body: patch.body !== undefined ? patch.body : baseDoc.body,
  };

  if (patch.direction) {
    workingDoc = withDesignDirection(workingDoc, directionValue(patch.direction));
  }

  const text = serializeDesign(workingDoc.tokens, workingDoc.body);
  const doc = parseDesign(text);
  const findings = bySeverity(checkDesign(doc));
  return { text, doc, findings };
}

/**
 * Reconcile an edited `DESIGN.md` working projection through
 * `prepareDesignReconciliation` + `reconcileDesignProjection`, preserving
 * conditional source version & metadata identity on save and retry.
 */
export async function saveDesignStudioProjection(
  io: DesignSystemPort,
  projection: DesignProjection,
  editedText: string,
  ids: { opId?: string; versionId?: string; retry?: boolean } = {},
): Promise<DesignReconcileResult> {
  const opId = ids.opId ?? newOpId();
  const versionId = ids.versionId ?? newVersionId();
  const request = await prepareDesignReconciliation({
    projection,
    text: editedText,
    opId,
    versionId,
    ...(ids.retry ? { retry: true } : {}),
  });
  return reconcileDesignProjection(io, request);
}

/**
 * **View Focus (`/i/:itemId`) for `DESIGN.md`:** renders the full specimen
 * (`DesignSystemView`) plus a **Governed Screens Matrix** showing live
 * `design check` / `auditScreen` status across canvas screens governed by this
 * system.
 */
export function DesignSystemFocusView(facts: FocusFacts) {
  const { canvasId, canvas, item, version, actor } = facts;
  const navigate = useNavigate();
  const [sourceText, setSourceText] = useState<string | null>(null);
  const [screenSources, setScreenSources] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    readBlobText(canvasId, version.blobHash)
      .then((text) => {
        if (live) setSourceText(text);
      })
      .catch(() => {
        if (live) setSourceText(null);
      });
    return () => {
      live = false;
    };
  }, [canvasId, version.blobHash]);

  const doc = useMemo(
    () => (sourceText !== null ? parseDesign(sourceText) : null),
    [sourceText],
  );

  const screenCandidateKey = useMemo(() => {
    const entries: string[] = [];
    for (const other of Object.values(canvas.items)) {
      if (other.id === item.id || itemKind(other) !== "screen" || isWireframeScreen(other)) continue;
      const v = other.versions.find((ver) => ver.id === other.currentVersionId) ?? other.versions[0];
      if (v) entries.push(`${other.id}\u0000${v.blobHash}`);
    }
    return entries.sort().join("\n");
  }, [canvas.items, item.id]);

  useEffect(() => {
    let live = true;
    if (!screenCandidateKey) {
      setScreenSources({});
      return;
    }
    const entries = screenCandidateKey.split("\n").map((row) => {
      const [id, blobHash] = row.split("\u0000");
      return { id: id!, blobHash: blobHash! };
    });
    void Promise.all(
      entries.map(async ({ id, blobHash }) => {
        try {
          const text = await readBlobText(canvasId, blobHash);
          return [id, text] as const;
        } catch {
          return [id, ""] as const;
        }
      }),
    ).then((pairs) => {
      if (!live) return;
      const next: Record<string, string> = {};
      for (const [id, html] of pairs) {
        if (html) next[id] = html;
      }
      setScreenSources(next);
    });
    return () => {
      live = false;
    };
  }, [canvasId, screenCandidateKey]);

  const matrix = useMemo(
    () =>
      doc ? computeGovernedScreensMatrix(canvas, item, doc.tokens, screenSources) : [],
    [canvas, item, doc, screenSources],
  );

  return (
    <div className="ds-focus-view" data-testid="ds-focus-view">
      <div className="ds-focus-scroll">
        <DesignSystemView
          canvasId={canvasId}
          blobHash={version.blobHash}
          author={version.createdBy ?? actor}
        />

        <section className="ds-governed-matrix" aria-label="Governed screens matrix">
          <div className="ds-governed-head">
            <h3>
              Governed Screens Matrix <span>{matrix.length}</span>
            </h3>
            <small>Live static audit (`design check`) against this DESIGN.md</small>
          </div>
          {matrix.length === 0 ? (
            <p className="ds-governed-empty">
              No HTML screens on this canvas are currently governed by this design system.
            </p>
          ) : (
            <div className="ds-governed-table-wrap">
              <table className="ds-governed-table">
                <thead>
                  <tr>
                    <th>Screen</th>
                    <th>Status</th>
                    <th>On-system tokens</th>
                    <th>Off-scale values</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row) => (
                    <tr key={row.itemId}>
                      <td>
                        <b>{row.title}</b>
                      </td>
                      <td>
                        <span className={`ds-matrix-badge ${row.status}`}>
                          {row.status === "loading"
                            ? "Auditing…"
                            : row.status === "pass"
                              ? "✓ Passing"
                              : `⚠ ${row.warningCount} finding${row.warningCount === 1 ? "" : "s"}`}
                        </span>
                      </td>
                      <td>{row.onSystemCount}</td>
                      <td>{row.offSystemCount}</td>
                      <td className="ds-matrix-actions">
                        <button
                          type="button"
                          className="focus-chip-btn"
                          onClick={() => navigate(itemPath(canvasId, row.itemId))}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="focus-chip-btn"
                          onClick={() => navigate(workbenchItemPath(canvasId, row.itemId))}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type StudioTab = "palette" | "typography" | "scale" | "components" | "direction";

/**
 * **Edit Focus (`/w/:itemId`) for `DESIGN.md`:** structured Token & Direction
 * Studio alongside a live specimen preview, backed by conditional
 * `reconcileDesignProjection` (and accompanied by `[ Studio | Code | Split ]`
 * raw Markdown in `ArtifactStage` since `caps.file === true`).
 */
export function DesignSystemFocusEdit(facts: FocusFacts) {
  const { canvasId, item, version, actor, canEdit, host, subtarget, setSubtarget, askAgent } = facts;
  const io = useMemo(() => designSystemIO(actor), [actor]);

  const [baseText, setBaseText] = useState<string | null>(null);
  const [draftText, setDraftText] = useState<string>("");
  const [projection, setProjection] = useState<DesignProjection | null>(null);
  const [pendingIds, setPendingIds] = useState<{ opId: string; versionId: string } | null>(null);
  const [tab, setTab] = useState<StudioTab>("palette");
  const [newColorName, setNewColorName] = useState("");
  const [newColorValue, setNewColorValue] = useState("#2563eb");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setPendingIds(null);
    setNotice(null);
    readBlobText(canvasId, version.blobHash)
      .then((text) => {
        if (!live) return;
        setBaseText(text);
        setDraftText(text);
      })
      .catch(() => {
        if (live) setBaseText("");
      });

    projectDesignSystem(io, {
      canvasId,
      target: item.containerId
        ? { kind: "group", groupId: item.containerId }
        : { kind: "canvas" },
    })
      .then((proj) => {
        if (live && proj.source.itemId === item.id) {
          setProjection(proj);
        }
      })
      .catch(() => {
        if (live) setProjection(null);
      });

    return () => {
      live = false;
    };
  }, [canvasId, item.id, item.containerId, version.blobHash, io]);

  const parsed = useMemo(() => parseDesign(draftText || "---\n---\n"), [draftText]);
  const findings = useMemo(() => bySeverity(checkDesign(parsed)), [parsed]);
  const [dirFields, setDirFields] = useState<DirectionFields>(() => directionFields());

  useEffect(() => {
    if (baseText === null) return;
    const initial = readDesignDirection(parseDesign(baseText || "---\n---\n"));
    if (initial.status === "valid") {
      setDirFields(directionFields(initial.direction));
    }
  }, [baseText]);

  if (baseText === null) {
    return <div className="page-note">Reading DESIGN.md…</div>;
  }

  const dirty = draftText !== baseText;

  const updatePatch = (patch: TokenStudioPatch) => {
    try {
      const next = applyTokenStudioPatch(draftText, patch);
      setDraftText(next.text);
      setNotice(null);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update token.");
    }
  };

  const selectTokenSubtarget = (tokenPath: string, label?: string) => {
    setSubtarget({
      kind: "ds-token",
      id: tokenPath,
      label: label ?? `Token: ${tokenPath}`,
    });
  };

  const saveStudio = async () => {
    if (!canEdit || busy || !dirty) return;
    setBusy(true);
    setNotice(null);
    try {
      if (projection && projection.source.versionId === version.id) {
        const ids = pendingIds ?? { opId: newOpId(), versionId: newVersionId() };
        setPendingIds(ids);
        const result = await saveDesignStudioProjection(io, projection, draftText, {
          opId: ids.opId,
          versionId: ids.versionId,
          retry: pendingIds !== null,
        });
        if (result.status === "accepted") {
          setPendingIds(null);
          setBaseText(draftText);
          if (result.savedProjection) setProjection(result.savedProjection);
          setNotice("Saved DESIGN.md via conditional projection.");
          return;
        }
        throw new Error(result.reason ?? "Conditional reconciliation was refused.");
      }

      // Direct conditional item.edit fallback when editing a standalone DESIGN.md item
      const blob = new Blob([draftText], { type: "text/markdown" });
      const uploaded = await host.putBlob(blob, version.filename || "DESIGN.md");
      await host.send([
        {
          type: "item.edit",
          itemId: item.id,
          expectedVersionId: version.id,
          expectedMetadata: { title: item.title, properties: item.properties },
          patch: {},
          version: {
            id: newVersionId(),
            blobHash: uploaded.blobHash,
            mimeType: version.mimeType || "text/markdown",
            filename: version.filename || "DESIGN.md",
            size: uploaded.size,
          },
        },
      ]);
      setBaseText(draftText);
      setNotice(`Saved v${item.versions.length + 1}`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save DESIGN.md.");
    } finally {
      setBusy(false);
    }
  };

  const colors = parsed.tokens.colors ?? {};
  const typography = parsed.tokens.typography ?? {};
  const spacing = parsed.tokens.spacing ?? {};
  const rounded = parsed.tokens.rounded ?? {};
  const components = parsed.tokens.components ?? {};

  return (
    <div className="ds-focus-edit" data-testid="ds-focus-edit">
      <div className="ds-studio-toolbar">
        <div className="ds-studio-tabs" role="tablist" aria-label="Design System Studio sections">
          {(
            [
              ["palette", `Palette (${Object.keys(colors).length})`],
              ["typography", `Typography (${Object.keys(typography).length})`],
              ["scale", "Scale & Surface"],
              ["components", `Components (${Object.keys(components).length})`],
              ["direction", "Direction & Voice"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`focus-chip-btn${tab === id ? " active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="spacer" />

        <span className={`ds-check-pill ${findings.length === 0 ? "pass" : "warn"}`}>
          {findings.length === 0
            ? "✓ All checks pass"
            : `⚠ ${findings.length} check${findings.length === 1 ? "" : "s"}`}
        </span>

        {notice && <span className="ds-studio-notice">{notice}</span>}

        {dirty && (
          <button
            type="button"
            className="focus-chip-btn"
            disabled={busy}
            onClick={() => {
              setDraftText(baseText);
              setPendingIds(null);
              setNotice(null);
            }}
          >
            Reset
          </button>
        )}

        <button
          type="button"
          className="focus-chip-btn primary"
          disabled={!canEdit || busy || !dirty}
          onClick={() => void saveStudio()}
          data-testid="ds-studio-save"
        >
          {busy ? "Saving…" : `Save DESIGN.md`}
        </button>
      </div>

      <div className="ds-studio-main">
        <div className="ds-studio-controls">
          {tab === "palette" && (
            <div className="ds-studio-section">
              <div className="ds-studio-meta-row">
                <label>
                  <span>System Name</span>
                  <input
                    type="text"
                    value={parsed.tokens.name ?? ""}
                    onChange={(e) => updatePatch({ name: e.target.value })}
                  />
                </label>
                <label>
                  <span>Description</span>
                  <input
                    type="text"
                    value={parsed.tokens.description ?? ""}
                    onChange={(e) => updatePatch({ description: e.target.value })}
                  />
                </label>
              </div>

              <h4>Color Swatches &amp; Live AA Contrast</h4>
              <div className="ds-token-list">
                {Object.entries(colors).map(([name, val]) => {
                  const hex = parseHex(String(val)) ? String(val) : "#000000";
                  const ink = readableInk(String(val));
                  const finding = findings.find((f) => f.where === `colors.${name}`);
                  const isSelected = subtarget?.id === `colors.${name}`;
                  return (
                    <div
                      key={name}
                      className={`ds-token-card${finding ? " has-warning" : ""}${isSelected ? " selected" : ""}`}
                      onClick={() => selectTokenSubtarget(`colors.${name}`)}
                    >
                      <div className="ds-token-card-head">
                        <b>{name}</b>
                        {ink && (
                          <span className="ds-token-ink-ratio" title="Best ink contrast">
                            {ink.ratio.toFixed(1)}:1
                          </span>
                        )}
                        <button
                          type="button"
                          className="ds-token-ask-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTokenSubtarget(`colors.${name}`);
                            askAgent(`Refine colors.${name} so it meets WCAG AA contrast while keeping brand feel.`);
                          }}
                          title="Ask Agent about this token"
                        >
                          💬
                        </button>
                      </div>
                      <div className="ds-token-color-row">
                        <input
                          type="color"
                          value={hex.slice(0, 7)}
                          aria-label={`Color picker for ${name}`}
                          onChange={(e) =>
                            updatePatch({ colors: { ...colors, [name]: e.target.value } })
                          }
                        />
                        <input
                          type="text"
                          value={String(val)}
                          aria-label={`Color value for ${name}`}
                          onChange={(e) =>
                            updatePatch({ colors: { ...colors, [name]: e.target.value } })
                          }
                        />
                      </div>
                      {finding && (
                        <div className="ds-token-finding" role="alert">
                          ⚠ {finding.what}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="ds-add-token-row">
                <input
                  type="text"
                  placeholder="New color name (e.g. accent)"
                  value={newColorName}
                  onChange={(e) => setNewColorName(e.target.value)}
                />
                <input
                  type="color"
                  value={newColorValue}
                  onChange={(e) => setNewColorValue(e.target.value)}
                />
                <button
                  type="button"
                  className="focus-chip-btn"
                  onClick={() => {
                    const key = newColorName.trim();
                    if (!key) return;
                    updatePatch({ colors: { ...colors, [key]: newColorValue } });
                    setNewColorName("");
                  }}
                >
                  + Add Color
                </button>
              </div>
            </div>
          )}

          {tab === "typography" && (
            <div className="ds-studio-section">
              <h4>Typography Scale</h4>
              <div className="ds-type-editor-list">
                {Object.entries(typography).map(([styleName, t]) => (
                  <div
                    key={styleName}
                    className="ds-type-editor-card"
                    onClick={() => selectTokenSubtarget(`typography.${styleName}`)}
                  >
                    <div className="ds-token-card-head">
                      <b>{styleName}</b>
                    </div>
                    <div className="ds-type-fields">
                      <label>
                        <span>Family</span>
                        <input
                          type="text"
                          value={t.fontFamily ?? ""}
                          onChange={(e) =>
                            updatePatch({
                              typography: {
                                ...typography,
                                [styleName]: { ...t, fontFamily: e.target.value },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Size</span>
                        <input
                          type="text"
                          value={t.fontSize ?? ""}
                          onChange={(e) =>
                            updatePatch({
                              typography: {
                                ...typography,
                                [styleName]: { ...t, fontSize: e.target.value },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Weight</span>
                        <input
                          type="text"
                          value={t.fontWeight !== undefined ? String(t.fontWeight) : ""}
                          onChange={(e) =>
                            updatePatch({
                              typography: {
                                ...typography,
                                [styleName]: { ...t, fontWeight: e.target.value },
                              },
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Line height</span>
                        <input
                          type="text"
                          value={t.lineHeight !== undefined ? String(t.lineHeight) : ""}
                          onChange={(e) =>
                            updatePatch({
                              typography: {
                                ...typography,
                                [styleName]: { ...t, lineHeight: e.target.value },
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "scale" && (
            <div className="ds-studio-section">
              <h4>Surface Treatment</h4>
              <div className="ds-surface-pills" role="group" aria-label="Surface treatment">
                {DESIGN_SURFACES.map((surf) => (
                  <button
                    key={surf}
                    type="button"
                    className={`focus-chip-btn${(parsed.tokens.surface ?? "flat") === surf ? " active" : ""}`}
                    onClick={() => updatePatch({ surface: surf })}
                  >
                    {surf}
                  </button>
                ))}
              </div>

              <h4>Spacing Scale</h4>
              <div className="ds-kv-list">
                {Object.entries(spacing).map(([stepName, val]) => (
                  <label key={stepName} className="ds-kv-row">
                    <span>{stepName}</span>
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) =>
                        updatePatch({ spacing: { ...spacing, [stepName]: e.target.value } })
                      }
                    />
                  </label>
                ))}
              </div>

              <h4>Corner Radii (`rounded`)</h4>
              <div className="ds-kv-list">
                {Object.entries(rounded).map(([radName, val]) => (
                  <label key={radName} className="ds-kv-row">
                    <span>{radName}</span>
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) =>
                        updatePatch({ rounded: { ...rounded, [radName]: e.target.value } })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {tab === "components" && (
            <div className="ds-studio-section">
              <h4>Component Token Cards</h4>
              <div className="ds-type-editor-list">
                {Object.entries(components).map(([compName, props]) => (
                  <div
                    key={compName}
                    className="ds-type-editor-card"
                    onClick={() => selectTokenSubtarget(`components.${compName}`)}
                  >
                    <div className="ds-token-card-head">
                      <b>{compName}</b>
                    </div>
                    <div className="ds-kv-list">
                      {Object.entries(props).map(([propKey, propVal]) => (
                        <label key={propKey} className="ds-kv-row">
                          <span>{propKey}</span>
                          <input
                            type="text"
                            value={propVal}
                            onChange={(e) =>
                              updatePatch({
                                components: {
                                  ...components,
                                  [compName]: { ...props, [propKey]: e.target.value },
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "direction" && (
            <div className="ds-studio-section">
              <h4>Reusable Direction</h4>
              <label className="image-meta-field">
                <span>Stage</span>
                <select
                  value={dirFields.stage}
                  onChange={(e) => {
                    const next = {
                      ...dirFields,
                      stage: e.target.value as DirectionFields["stage"],
                    };
                    setDirFields(next);
                  }}
                >
                  <option value="provisional">Provisional direction</option>
                  <option value="accepted">Accepted reusable treatments</option>
                </select>
              </label>
              <label className="image-meta-field">
                <span>Why this direction?</span>
                <textarea
                  rows={2}
                  value={dirFields.rationale}
                  onChange={(e) => setDirFields({ ...dirFields, rationale: e.target.value })}
                />
              </label>
              <label className="image-meta-field">
                <span>Task hierarchy (one step per line)</span>
                <textarea
                  rows={2}
                  value={dirFields.taskHierarchy}
                  onChange={(e) => setDirFields({ ...dirFields, taskHierarchy: e.target.value })}
                />
              </label>
              <label className="image-meta-field">
                <span>Layout &amp; Density</span>
                <input
                  type="text"
                  value={dirFields.layout}
                  placeholder="Layout guidance…"
                  onChange={(e) => setDirFields({ ...dirFields, layout: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="focus-chip-btn"
                onClick={() => updatePatch({ direction: dirFields })}
              >
                Apply Direction to Draft
              </button>

              <h4>Markdown Prose &amp; Voice Sections</h4>
              <textarea
                className="ds-prose-textarea"
                rows={8}
                value={parsed.body}
                onChange={(e) => updatePatch({ body: e.target.value })}
              />
            </div>
          )}
        </div>

        <aside className="ds-studio-preview" aria-label="Live specimen preview">
          <h4>Live Specimen Preview</h4>
          {findings.length > 0 && (
            <div className="ds-live-findings">
              {findings.map((f, idx) => (
                <div key={idx} className={`ds-live-finding ${f.severity}`}>
                  <b>{f.where}:</b> {f.what}
                </div>
              ))}
            </div>
          )}

          <div className="ds-live-swatches">
            {Object.entries(colors).map(([name, value]) => {
              const resolved = String(resolveToken(parsed.tokens, value) ?? value);
              const ink = readableInk(resolved);
              return (
                <div
                  key={name}
                  className="ds-live-swatch"
                  style={{ background: resolved, color: ink?.color ?? "inherit" }}
                >
                  <span>{name}</span>
                  <code>{resolved}</code>
                </div>
              );
            })}
          </div>

          {Object.keys(components).length > 0 && (
            <div className="ds-live-components">
              <h5>Components (resolved `{`{colors.*}`}`)</h5>
              <div className="ds-live-comp-grid">
                {Object.entries(components).map(([compName, props]) => {
                  const css = componentCss((v) => resolveToken(parsed.tokens, v), props);
                  const shape = componentShape(compName);
                  return (
                    <div key={compName} className="ds-live-comp-card">
                      <span
                        className={`ds-pv ds-pv-${shape}`}
                        style={css as React.CSSProperties}
                      >
                        {compName}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function isFocusableDesignSystem(item: Item, _version: ItemVersion): boolean {
  return isDesignSystem(item) || item.properties?.role === DESIGN_SYSTEM_ROLE;
}

export const designSystemFocusFacet: FocusFacetRecord = {
  id: "builtin.design-system",
  matches: isFocusableDesignSystem,
  priority: 5,
  view: DesignSystemFocusView,
  edit: DesignSystemFocusEdit,
  agentPrompts: [
    {
      label: "Audit AA contrast",
      prompt: "Audit all color token pairs for WCAG AA contrast and fix any failures.",
    },
    {
      label: "Tighten type scale",
      prompt: "Refine the typography scale and hierarchy for stronger visual rhythm.",
    },
    {
      label: "Add dark palette",
      prompt: "Propose a cohesive dark-surface token set that preserves brand voice.",
    },
  ],
};
