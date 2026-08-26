import { useUiStore } from "../stores/uiStore.ts";

/**
 * Every stage navigation a PERSON makes goes through here: grabbing the
 * wheel clears the watch, in one spelling — the canvas's setViewport rule
 * ("the user grabbing the wheel always wins"), restated for a stage that
 * navigates instead of panning. Follow-driven navigation deliberately does
 * NOT use this; it navigates with `replace` and must not clear itself.
 */
export function goStage(navigate: (path: string) => void, path: string): void {
  useUiStore.getState().setFollow(null);
  navigate(path);
}
