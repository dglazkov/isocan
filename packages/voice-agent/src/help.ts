/**
 * **The "?" beside a setting: hover, click, and one card at a time.**
 *
 * The markup does most of it. Each glyph is a `<button commandfor=… command=
 * "toggle-popover">` and each explanation is a `popover="hint"` card, so click,
 * keyboard activation, light dismiss and the Escape key come from the browser
 * where it has them rather than from here.
 *
 * Three things it does not have everywhere, which is why this file exists:
 *
 * - **Hover.** `interestfor` is the declarative answer and it is Chrome-only,
 *   so hover is wired here for every browser rather than being a second path
 *   that works in one. It is gated on a MOUSE pointer: a touch reports enter
 *   and leave around its own tap, and honouring that would open the card and
 *   shut it again under the same finger.
 * - **One at a time.** `popover="hint"` closes other hints where that value is
 *   known. Where it is not — Safari, and Chrome before 151 — the value is
 *   invalid, the element is a manual popover, and nothing closes it but us.
 * - **Escape.** A hint popover gets a close watcher and swallows the key; a
 *   manual one has none, so the keydown reaches the settings dialog and closes
 *   the whole surface, losing the focus restoration that put the person there.
 *   Closing the card here is what keeps Escape meaning "the card" while a card
 *   is open.
 *
 * What it deliberately does not do: move focus. The card is read beside the
 * control it explains, the glyph keeps whatever focus it already had, and the
 * dialog's own focus behaviour is untouched.
 */

/** Long enough that sweeping the pointer across the dialog does not open
 *  everything it passes; short enough that a deliberate hover feels immediate. */
const HOVER_OPEN_MS = 300;
/** A grace period, not a delay: the pointer needs a moment to cross from the
 *  glyph into the card, and the card is allowed to catch it. */
const HOVER_CLOSE_MS = 150;

/** The popover's own account of its state, which some DOM libs do not type. */
type PopoverToggle = Event & { newState?: string };

/**
 * Wire every "?" in the settings dialog. The glyphs and the cards come from the
 * markup; this adds the parts the platform does not have everywhere — hover,
 * one card at a time, light dismiss, and Escape closing the card instead of the
 * whole dialog — and leaves focus, tab order and the dialog's own behaviour
 * exactly as they were.
 */
export function wireSettingsHelp(doc: Document = document): void {
  const settings = doc.querySelector<HTMLDialogElement>("#settings");
  if (!settings) return;
  const pairs: { button: HTMLButtonElement; card: HTMLElement }[] = [];
  for (const button of settings.querySelectorAll<HTMLButtonElement>(".voice-help")) {
    const card = doc.getElementById(button.getAttribute("commandfor") ?? "");
    if (card) pairs.push({ button, card });
  }
  if (!pairs.length) return;

  /**
   * **What is showing, from the platform's own account of it.**
   *
   * `toggle` is the only witness to a light dismiss — that closes a card
   * without telling the button — and a set that only grew when WE opened
   * something would go stale the first time somebody clicked the background,
   * leaving Escape convinced there was something to close.
   */
  const showing = new Set<HTMLElement>();
  for (const { card } of pairs) {
    card.addEventListener("toggle", (event) => {
      if ((event as PopoverToggle).newState === "open") showing.add(card);
      else showing.delete(card);
    });
  }

  function show(card: HTMLElement): void {
    // A hover intent that is now fulfilled, and a close that was counting down
    // for a pointer which has since come back: either one firing later would
    // undo this a tenth of a second after it happened.
    clearTimeout(opening);
    clearTimeout(closing);
    for (const open of [...showing]) if (open !== card) hide(open);
    if (showing.has(card)) return;
    showing.add(card);
    card.showPopover();
  }

  function hide(card: HTMLElement): void {
    if (!showing.has(card)) return;
    // Escape, a press elsewhere and a second click are decisions. A hover
    // timer still counting down from before one of them must not reopen what
    // it closed — which is exactly what a stale one did, 133ms later.
    clearTimeout(opening);
    showing.delete(card);
    card.hidePopover();
  }

  let opening: ReturnType<typeof setTimeout> | undefined;
  let closing: ReturnType<typeof setTimeout> | undefined;
  const isMouse = (event: Event): boolean => (event as PointerEvent).pointerType === "mouse";

  for (const { button, card } of pairs) {
    button.addEventListener("pointerenter", (event) => {
      if (!isMouse(event)) return;
      // Before the early return: a pointer that comes back to a card that is
      // still open must also stop the close that its leaving started.
      clearTimeout(closing);
      if (showing.has(card)) return;
      opening = setTimeout(() => show(card), HOVER_OPEN_MS);
    });
    button.addEventListener("pointerleave", (event) => {
      if (!isMouse(event)) return;
      clearTimeout(opening);
      closing = setTimeout(() => hide(card), HOVER_CLOSE_MS);
    });
    // Hoverable, per WCAG 1.4.13: the pointer can travel from the glyph onto
    // the card, and the card keeps catching it.
    card.addEventListener("pointerenter", () => clearTimeout(closing));
    card.addEventListener("pointerleave", (event) => {
      if (isMouse(event)) hide(card);
    });
  }

  // Invoker commands are the declarative spelling: where the platform has
  // them, the glyph needs nothing from us. Where it does not (Safari before
  // 26.2), a click is the whole of the intent — and Enter and Space on a button
  // arrive here as one, so the keyboard path is this same line.
  if (!("commandForElement" in HTMLButtonElement.prototype)) {
    for (const { button, card } of pairs) {
      button.addEventListener("click", () => (showing.has(card) ? hide(card) : show(card)));
    }
  }

  // Light dismiss, by hand, for the browsers where "hint" said nothing and the
  // card therefore never dismisses itself. A press on the glyph that opened the
  // card is not an outside press: the click that follows is a toggle, and
  // closing here would make it a close and an open.
  doc.addEventListener("pointerdown", (event) => {
    if (!showing.size) return;
    const target = event.target as Node | null;
    for (const { button, card } of pairs) {
      if (!showing.has(card)) continue;
      if (target && (card.contains(target) || button.contains(target))) continue;
      hide(card);
    }
  });

  settings.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !showing.size) return;
    // The card first, the surface second: Escape means the topmost thing, and
    // the dialog's own handler would otherwise take this key and close with the
    // person's place in it.
    event.preventDefault();
    for (const card of [...showing]) hide(card);
  });
}
