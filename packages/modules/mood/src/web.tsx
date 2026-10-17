import "../assets/styles.css";
import { useMemo, useState, type FormEvent } from "react";
import {
  AREA_FILENAME,
  AREA_MIME,
  newGroupId,
  type CanvasContents,
  type DialogFacts,
  type Item,
  type ModuleMenuFacts,
  type ModuleMenuRow,
  type OverlayFacts,
  type WebModule,
} from "@isocan/core";
import {
  IMAGE_MODEL_DEFAULT,
  IMAGE_ROUTE,
  MOOD_BOARD_BYTES,
  MOOD_DEFAULT_N,
  MOOD_DIALS,
  MOOD_MAX_N,
  MOOD_MORE_N,
  MOOD_PROPS,
  findMoodBoard,
  isMoodDial,
  moodCostLine,
  moodDropOps,
  moodKeepPlan,
  moodTrays,
  moodWordsFromPrompt,
  type ImageRequest,
  type ImageResponse,
  type MoodBoardBlob,
  type MoodDial,
} from "@isocan/core/mood";
import { moodModule } from "./core.ts";

/** Ask the home's image route to generate candidate tiles on this canvas. */
export async function requestMoodImages(
  req: ImageRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ImageResponse> {
  const res = await fetchImpl(IMAGE_ROUTE, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
  });
  const body = (await res.json().catch(() => null)) as (Partial<ImageResponse> & { error?: string }) | null;
  if (!res.ok || !Array.isArray(body?.items)) {
    throw new Error(body?.error ?? `the home answered ${res.status}`);
  }
  return body as ImageResponse;
}

/** Parse `--from <itemId> [--push <dial>]` or plain words passed to `mood-explore`. */
export function parseMoodExploreArgs(
  rawArgs: string,
  canvas: CanvasContents,
): { parentItem: Item | null; words: string; count: number; push: MoodDial | "" } {
  const trimmed = rawArgs.trim();
  const fromMatch = /^--from\s+(\S+)(?:\s+--push\s+(\S+))?$/.exec(trimmed);
  if (fromMatch) {
    const parentItem = canvas.items[fromMatch[1]!] ?? null;
    const dial = fromMatch[2];
    if (parentItem) {
      return {
        parentItem,
        words: moodWordsFromPrompt(parentItem.properties[MOOD_PROPS.prompt], parentItem.title),
        count: MOOD_MORE_N,
        push: isMoodDial(dial) ? dial : "",
      };
    }
  }
  return { parentItem: null, words: trimmed, count: MOOD_DEFAULT_N, push: "" };
}

function MoodExploreDialog({ canvasId, canvas, args, canEdit, host }: DialogFacts) {
  const initial = useMemo(() => parseMoodExploreArgs(args, canvas), [args, canvas]);
  const [words, setWords] = useState(initial.words);
  const [count, setCount] = useState(initial.count);
  const [push, setPush] = useState<MoodDial | "">(initial.push);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || busy || !words.trim()) return;
    setBusy(true);
    setProblem(null);
    try {
      const res = await requestMoodImages({
        canvasId,
        actor: host.viewer,
        prompt: words.trim(),
        n: count,
        ...(initial.parentItem ? { parent: initial.parentItem.id } : {}),
        ...(push ? { push } : {}),
      });
      const ids = res.items.map((i) => i.itemId);
      host.select(ids);
      host.reveal(ids);
      host.close();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not generate images.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mood-dialog" onSubmit={(e) => void onSubmit(e)}>
      {initial.parentItem && (
        <p className="mood-parent">
          Varying <strong>{initial.parentItem.title}</strong>
        </p>
      )}
      <label className="mood-field">
        What should it feel like?
        <textarea
          rows={3}
          aria-label="What should it feel like?"
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="a quiet bakery at dawn, linen and warm stone"
          disabled={!canEdit || busy}
        />
      </label>
      <div className="mood-row">
        <label className="mood-field">
          Tiles
          <input
            type="number"
            aria-label="Tiles"
            min={1}
            max={MOOD_MAX_N}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(MOOD_MAX_N, Number(e.target.value) || 1)))
            }
            disabled={!canEdit || busy}
          />
        </label>
        {initial.parentItem && (
          <label className="mood-field">
            Push dial
            <select
              aria-label="Push dial"
              value={push}
              onChange={(e) => setPush(isMoodDial(e.target.value) ? e.target.value : "")}
              disabled={!canEdit || busy}
            >
              <option value="">More like this</option>
              {MOOD_DIALS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <p className="mood-cost" data-testid="mood-cost-line">
        {moodCostLine(count, IMAGE_MODEL_DEFAULT)}
      </p>
      {problem && (
        <p className="mood-problem" role="alert">
          {problem}
        </p>
      )}
      <div className="mood-actions">
        <button type="button" className="btn" onClick={host.close} disabled={busy}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn primary"
          disabled={!canEdit || busy || !words.trim()}
        >
          {busy ? "Drawing…" : "Draw spread"}
        </button>
      </div>
    </form>
  );
}

function MoodTrayOverlay({ canvasId, canvas, host, groupMode }: OverlayFacts) {
  const trays = useMemo(() => moodTrays(canvas), [canvas]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  if (trays.length === 0) return null;

  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Could not update the mood board.");
    } finally {
      setBusy(false);
    }
  }

  async function keepTiles(ids: readonly string[]) {
    if (ids.length === 0) return;
    let boardBlob: MoodBoardBlob | undefined;
    if (!findMoodBoard(canvas)) {
      const filename = groupMode === "groups" ? "group.md" : AREA_FILENAME;
      const blob = new Blob([MOOD_BOARD_BYTES], { type: AREA_MIME });
      const put = await host.putBlob(blob, filename);
      boardBlob = { blobHash: put.blobHash, size: put.size, mimeType: AREA_MIME, filename };
    }
    const plan = moodKeepPlan({ canvas, groupMode, itemIds: ids, ...(boardBlob ? { boardBlob } : {}) });
    if (plan.ops.length > 0) await host.send(plan.ops, newGroupId());
    setPicked((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  async function dropTiles(opts: { itemIds?: readonly string[]; run?: string }) {
    const { droppedIds, ops } = moodDropOps(canvas, opts);
    if (ops.length > 0) await host.send(ops, newGroupId());
    setPicked((prev) => {
      const next = { ...prev };
      for (const id of droppedIds) delete next[id];
      return next;
    });
  }

  async function branchTile(tile: Item, dial?: MoodDial) {
    const words = moodWordsFromPrompt(tile.properties[MOOD_PROPS.prompt], tile.title);
    const res = await requestMoodImages({
      canvasId,
      actor: host.viewer,
      prompt: words,
      n: MOOD_MORE_N,
      parent: tile.id,
      ...(dial ? { push: dial } : {}),
    });
    const ids = res.items.map((i) => i.itemId);
    host.select(ids);
    host.reveal(ids);
  }

  return (
    <section className="mood-tray" aria-label="Mood tray">
      {problem && (
        <p className="mood-problem" role="alert">
          {problem}
        </p>
      )}
      {trays.map((tray) => {
        const pickedInTray = tray.candidates.filter((c) => picked[c.id]).map((c) => c.id);
        return (
          <div key={tray.run} className="mood-tray-run" data-mood-run={tray.run}>
            <header className="mood-tray-head">
              <div className="mood-tray-title">
                <span className="mood-tray-words">{tray.words}</span>
                <span className="mood-tray-meta">
                  {tray.candidates.length} candidate{tray.candidates.length === 1 ? "" : "s"}
                  {tray.kept.length > 0 ? ` · ${tray.kept.length} kept` : ""}
                </span>
              </div>
              <button
                type="button"
                className="mood-btn"
                disabled={busy}
                onClick={() => void act(() => dropTiles({ run: tray.run }))}
              >
                Close tray
              </button>
            </header>
            {pickedInTray.length > 0 && (
              <div className="mood-tray-bar">
                <button
                  type="button"
                  className="mood-btn mood-btn-keep"
                  disabled={busy}
                  onClick={() => void act(() => keepTiles(pickedInTray))}
                >
                  Keep selected ({pickedInTray.length})
                </button>
                <button
                  type="button"
                  className="mood-btn"
                  disabled={busy}
                  onClick={() => void act(() => dropTiles({ itemIds: pickedInTray }))}
                >
                  Drop selected
                </button>
              </div>
            )}
            <ul className="mood-tray-grid">
              {tray.candidates.map((tile) => {
                const ver =
                  tile.versions.find((v) => v.id === tile.currentVersionId) ??
                  tile.versions.at(-1);
                const url = ver
                  ? `/api/projects/${encodeURIComponent(canvasId)}/blobs/${encodeURIComponent(ver.blobHash)}`
                  : "";
                const isPicked = Boolean(picked[tile.id]);
                return (
                  <li
                    key={tile.id}
                    className={`mood-tile${isPicked ? " mood-tile-picked" : ""}`}
                    data-mood-tile={tile.id}
                  >
                    <img
                      className="mood-tile-thumb"
                      src={url}
                      alt={tile.title}
                      onClick={() => {
                        setPicked((prev) => ({ ...prev, [tile.id]: !isPicked }));
                        host.select([tile.id]);
                        host.reveal([tile.id]);
                      }}
                    />
                    <span className="mood-tile-axis">
                      {tile.properties[MOOD_PROPS.axis] ?? "candidate"}
                    </span>
                    <div className="mood-tile-controls">
                      <button
                        type="button"
                        className="mood-btn mood-btn-keep"
                        aria-label={`Keep ${tile.title}`}
                        disabled={busy}
                        onClick={() => void act(() => keepTiles([tile.id]))}
                      >
                        ✓ Keep
                      </button>
                      <button
                        type="button"
                        className="mood-btn"
                        aria-label={`Drop ${tile.title}`}
                        disabled={busy}
                        onClick={() => void act(() => dropTiles({ itemIds: [tile.id] }))}
                      >
                        ✕ Drop
                      </button>
                      <button
                        type="button"
                        className="mood-btn"
                        aria-label={`More like ${tile.title}`}
                        title={moodCostLine(MOOD_MORE_N, IMAGE_MODEL_DEFAULT)}
                        disabled={busy}
                        onClick={() => void act(() => branchTile(tile))}
                      >
                        More like this
                      </button>
                      <select
                        className="mood-push-select"
                        aria-label={`Push ${tile.title}`}
                        value=""
                        disabled={busy}
                        onChange={(e) => {
                          const dial = e.target.value;
                          e.target.value = "";
                          if (isMoodDial(dial)) void act(() => branchTile(tile, dial));
                        }}
                      >
                        <option value="">Push →</option>
                        {MOOD_DIALS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** Item context menu: *More like this…* and *Push ▸* on a single kept or reference image. */
export function moodMenu({ items, open }: ModuleMenuFacts): ModuleMenuRow[] {
  if (items.length !== 1) return [];
  const item = items[0]!;
  const mood = item.properties[MOOD_PROPS.mood];
  if (mood !== "kept" && mood !== "reference") return [];
  const ver = item.versions.find((v) => v.id === item.currentVersionId) ?? item.versions.at(-1);
  if (!ver?.mimeType.startsWith("image/")) return [];
  return [
    {
      label: "More like this…",
      writes: true,
      run: () => open("mood-explore", `--from ${item.id}`),
    },
    {
      label: "Push",
      writes: true,
      run: () => {},
      submenu: MOOD_DIALS.map((dial) => ({
        label: dial,
        writes: true,
        run: () => open("mood-explore", `--from ${item.id} --push ${dial}`),
      })),
    },
  ];
}

export const moodWeb: WebModule<
  never,
  never,
  never,
  never,
  typeof MoodTrayOverlay,
  typeof MoodExploreDialog
> = {
  core: moodModule,
  actions: [
    {
      id: "mood.explore",
      name: "Explore a look",
      hint: "generate non-UI images to find how this should feel",
      opens: "mood-explore",
    },
  ],
  dialogs: [{ id: "mood-explore", title: "Explore a look", wide: true, component: MoodExploreDialog }],
  overlays: [{ region: "right", label: "Mood tray", component: MoodTrayOverlay }],
  menu: moodMenu,
};

export default moodWeb;
