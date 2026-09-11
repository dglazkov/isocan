import {
  PAPERS,
  TEXT_FACES,
  TEXT_STYLES,
  TEXT_STYLE_LABEL,
  paperLabel,
  textFaceLabel,
  type Paper,
  type TextFace,
  type TextStyle,
} from "@isocan/core";
import type { MenuEntry } from "../components/ContextMenu.tsx";
import { useUiStore } from "../stores/uiStore.ts";

/**
 * **Right-click the T for what the next node will look like** (9 Sep 2026).
 *
 * > "if you right click on it, show the colors and font settings and the user
 * > can select them and they are now the default"
 *
 * The defaults already existed and already stuck — `lastTextStyle`,
 * `lastTextFace` and `lastPaper` are written to this browser and a new node
 * opens at whatever you last used. What was missing was a way to REACH them
 * without placing a node first and restyling it, which meant the only way to
 * change the default was to make something you did not want.
 *
 * So this is not new state, and that is the whole point: it is a second door
 * onto the state the composer already writes. Set "title" here and the next
 * node opens as a title; set it in the composer and this menu will be showing
 * "title" ticked the next time it opens. Two doors, one fact.
 *
 * ## Why a menu and not an ink-well
 *
 * The pen grows a row of swatches under it while it is active, and that shape
 * was considered here. It does not fit: the pen has ONE choice (a colour) and
 * text has three, and a rail 40px wide has nowhere to put a type ladder. A
 * menu also answers a question the swatches cannot — right-click is where a
 * person looks for "what are the settings for this thing".
 */

/** Ticked by what is current, so the menu says what you are about to get
 *  rather than only offering to change it. */
function styleEntries(style: TextStyle, face: TextFace, paper: Paper | null): MenuEntry[] {
  return TEXT_STYLES.map((s) => ({
    label: TEXT_STYLE_LABEL[s],
    checked: s === style,
    run: () => useUiStore.getState().setLastText(s, face, paper),
  }));
}

function faceEntries(style: TextStyle, face: TextFace, paper: Paper | null): MenuEntry[] {
  return TEXT_FACES.map((f) => ({
    label: textFaceLabel(f),
    checked: f === face,
    run: () => useUiStore.getState().setLastText(style, f, paper),
  }));
}

function paperEntries(style: TextStyle, face: TextFace, paper: Paper | null): MenuEntry[] {
  return [
    /**
     * **None first, and it is a real answer rather than a way out.**
     *
     * A text node with no paper is a caption written straight onto the canvas,
     * which is the commoner of the two things this tool makes — a post-it is
     * the decorated case. Putting it at the top with a tick keeps "no paper"
     * something you can choose and see you have chosen, instead of an absence
     * you infer from five unticked rows.
     */
    {
      label: "None",
      checked: paper === null,
      run: () => useUiStore.getState().setLastText(style, face, null),
    },
    { separator: "" },
    ...PAPERS.map((p) => ({
      label: paperLabel(p),
      checked: p === paper,
      run: () => useUiStore.getState().setLastText(style, face, p),
    })),
  ];
}

/**
 * The entries for the text tool's own menu, read from the store at the moment
 * it opens.
 *
 * Read here rather than passed in, because a menu is built once when it is
 * opened and never re-rendered — taking the values as arguments would let a
 * caller hand it stale ones, and there is exactly one caller.
 */
export function textToolMenu(): MenuEntry[] {
  const { lastTextStyle: style, lastTextFace: face, lastPaper: paper } = useUiStore.getState();
  return [
    { separator: "NEXT TEXT NODE" },
    /* The current answer beside each name, so the shape of the menu says what
       you are about to get without opening all three — the `menu-value` the
       Background row already uses. */
    { label: "Size", value: TEXT_STYLE_LABEL[style], run: () => {}, submenu: styleEntries(style, face, paper) },
    { label: "Font", value: textFaceLabel(face), run: () => {}, submenu: faceEntries(style, face, paper) },
    {
      label: "Paper",
      value: paper === null ? "None" : paperLabel(paper),
      run: () => {},
      submenu: paperEntries(style, face, paper),
    },
  ];
}
