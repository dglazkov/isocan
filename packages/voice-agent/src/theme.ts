/**
 * **The theme preference: light, dark, or whatever the device says.**
 *
 * The page already resolves and applies the theme — an inline script in
 * `voice.html` reads the preference before the first paint, so a dark choice
 * is never a white flash, and it follows the OS live from there. This is the
 * CONTROL for that preference and nothing else: it writes the same stored
 * value and asks the page's own applier to run again, because a second
 * resolution rule here would be a second answer to "what theme is this?" the
 * first time the two disagreed.
 *
 * That is also why the storage key is spelled here as well as in the inline
 * script: a pre-paint script cannot import a module, so one of the two has to
 * repeat the other. A test pins this module's writes and the inline script's
 * reads to `isocan.theme`, and the canvas app reads the same key (see its own
 * `lib/theme.ts`) — which nothing asserts, so changing it is a deliberate
 * edit in three places, not one.
 */

/**
 * **The three words, declared here rather than imported.**
 *
 * The canvas app has a type of the same name in `packages/web/src/lib/theme.ts`,
 * and this package must not reach into it: that module is a zustand store, so
 * borrowing its type would make the page's typecheck depend on the app's React
 * toolchain — the coupling this package exists to be free of. Three string
 * literals is the whole of what is shared, and the KEY below is the part that
 * actually has to agree.
 */
type ThemePref = "light" | "dark" | "system";

const KEY = "isocan.theme";

/** What the page's own pre-paint script answers for the stored preference:
 *  anything that is not one of the three is "system". */
function readPref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    // A browser that refuses storage is not a broken page; it just forgets.
    return "system";
  }
}

/**
 * Wire the three choices in the settings dialog.
 *
 * The choices are real radios in a real fieldset, so the arrow keys, the group
 * and the checked state are the platform's; what this adds is the write, the
 * call to the page's applier, and the line that says which theme that adds up
 * to — including while "system" and the device is the one that changed.
 */
export function wireThemeChoice(doc: Document = document): void {
  const choices = [...doc.querySelectorAll<HTMLInputElement>("#theme-panel input[name=theme]")];
  const line = doc.getElementById("theme-now");
  if (!choices.length || !line) return;
  // Typed once, because the guard's narrowing does not reach the closures below.
  const now: HTMLElement = line;
  const view = doc.defaultView as (Window & { applyVoiceTheme?: () => void }) | null;
  /** Set when the browser refuses the write. The applier re-reads the stored
   *  value, so a refused choice is a choice this page cannot take — and the
   *  radio must not sit somewhere the theme disagrees with. */
  let refused = false;

  function render(): void {
    const pref = readPref();
    for (const choice of choices) choice.checked = choice.value === pref;
    const resolved = doc.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const said = pref === "system" ? `Following your device: ${resolved} right now.` : `Pinned to ${pref}.`;
    now.textContent = refused ? `${said} This browser will not remember the choice.` : said;
  }

  for (const choice of choices) {
    choice.addEventListener("change", () => {
      if (!choice.checked) return;
      refused = false;
      try {
        localStorage.setItem(KEY, choice.value);
      } catch {
        refused = true;
      }
      view?.applyVoiceTheme?.();
      render();
    });
  }

  // The device can flip while this dialog is open, and the page follows it —
  // this listener is registered after the page's own, so by the time it runs
  // the attribute is already the new theme and the line can say which it is.
  view?.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", render);
  render();
}
