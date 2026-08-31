import { create } from "zustand";

/**
 * Light / dark / system theming. The user's PREFERENCE is one of three; the
 * RESOLVED theme is only ever "light" or "dark" — "system" resolves against the
 * OS choice (`prefers-color-scheme`) and re-resolves when the OS flips.
 *
 * The resolved theme is written to `data-theme` on <html>; every color in the
 * app is a CSS variable keyed off that attribute (see styles.css). An inline
 * script in index.html sets the attribute before first paint so there is no
 * flash of the wrong theme — this module keeps it in sync from then on.
 */
export type ThemePref = "light" | "dark" | "system";

const KEY = "isocan.theme";
const media = window.matchMedia("(prefers-color-scheme: dark)");

/** What the person last chose, or `system` when they have not. Read through
 *  `resolveTheme` rather than directly — the preference is not the theme. */
function readThemePref(): ThemePref {
  const raw = localStorage.getItem(KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/** What "system" currently means. */
/** What the OS is asking for right now. Only meaningful under the `system`
 *  preference, which is why it is not exported. */
function systemTheme(): "light" | "dark" {
  return media.matches ? "dark" : "light";
}

function resolve(pref: ThemePref): "light" | "dark" {
  return pref === "system" ? systemTheme() : pref;
}

function apply(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolve(pref);
}

interface ThemeState {
  pref: ThemePref;
  /** The concrete theme in effect right now — for UI that needs to know. */
  resolved: "light" | "dark";
  setPref: (pref: ThemePref) => void;
}

/** Light or dark, resolved: the person's choice when they made one, and the
 *  OS's answer when they left it on `system`. */
export const useTheme = create<ThemeState>((set) => {
  const pref = readThemePref();
  return {
    pref,
    resolved: resolve(pref),
    setPref: (pref) => {
      localStorage.setItem(KEY, pref);
      apply(pref);
      set({ pref, resolved: resolve(pref) });
    },
  };
});

/**
 * Start syncing the OS choice. Called once at boot. The `data-theme` attribute
 * is already correct (index.html set it) — this only matters while the pref is
 * "system", where an OS flip must repaint the app live.
 */
export function initTheme(): void {
  media.addEventListener("change", () => {
    const { pref } = useTheme.getState();
    if (pref === "system") {
      apply(pref);
      useTheme.setState({ resolved: systemTheme() });
    }
  });
}
