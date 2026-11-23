// @vitest-environment jsdom

/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { PROJECT_TABS_STORAGE_KEY } from "@isocan/core/project-tabs";
import { buildHomeInbox, type InlineReplyPayload } from "@isocan/core/inbox-model";
import { TopNav } from "../src/components/shell/TopNav.tsx";
import { HomeInbox } from "../src/components/shell/HomeInbox.tsx";
import { useUiStore } from "../src/stores/uiStore.ts";
import { useCanvasStore } from "../src/stores/canvasStore.ts";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const actor = { id: "usr_acme_ada", name: "Ada" };
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ uiHidden: false, paletteOpen: null });
  useCanvasStore.setState({ record: null, queue: [], sessions: [], capability: "edit" });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  host.remove();
  vi.restoreAllMocks();
});

describe("TopNav shell component", () => {
  it("renders open tabs, switches tabs, closes to neighbour/Home, and creates a new canvas tab", async () => {
    const navigated: string[] = [];
    const onCreateCanvas = vi.fn(async () => ({ id: "prj_new", title: "Acme New" }));

    await act(async () => {
      root.render(
        h(
          MemoryRouter,
          { initialEntries: ["/p/prj_alpha"] },
          h(TopNav, {
            actor,
            initialState: {
              tabs: [
                { id: "prj_alpha", title: "Acme Alpha", activity: "idle" },
                { id: "prj_beta", title: "Acme Beta", activity: "idle" },
              ],
              activeId: "prj_alpha",
            },
            onNavigate: (path) => navigated.push(path),
            onCreateCanvas,
          }),
        ),
      );
    });

    const tabs = () => Array.from(host.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs().map((t) => t.querySelector(".shell-tab-title")?.textContent)).toEqual([
      "Acme Alpha",
      "Acme Beta",
    ]);
    expect(tabs()[0]!.getAttribute("aria-selected")).toBe("true");

    // Switch to the second tab.
    await act(async () => {
      tabs()[1]!.click();
    });
    expect(navigated).toContain("/p/prj_beta");
    expect(tabs()[1]!.getAttribute("aria-selected")).toBe("true");

    // Create a new canvas tab via `+`.
    const newBtn = host.querySelector<HTMLButtonElement>('button[aria-label="New canvas"]')!;
    await act(async () => {
      newBtn.click();
    });
    expect(onCreateCanvas).toHaveBeenCalledTimes(1);
    expect(tabs()).toHaveLength(3);
    expect(navigated).toContain("/p/prj_new");
    expect(localStorage.getItem(PROJECT_TABS_STORAGE_KEY)).toContain("prj_new");

    // Close the active tab -> selects neighbour (`prj_beta`).
    const closeNew = host.querySelector<HTMLButtonElement>('button[aria-label="Close Acme New"]')!;
    await act(async () => {
      closeNew.click();
    });
    expect(tabs()).toHaveLength(2);
    expect(navigated[navigated.length - 1]).toBe("/p/prj_beta");
  });

  it("toggles Hide-UI mode and renders the restore affordance", async () => {
    await act(async () => {
      root.render(
        h(
          MemoryRouter,
          { initialEntries: ["/p/prj_alpha"] },
          h(TopNav, {
            actor,
            initialState: {
              tabs: [{ id: "prj_alpha", title: "Acme Alpha", activity: "idle" }],
              activeId: "prj_alpha",
            },
          }),
        ),
      );
    });

    const hideBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Hide interface"]')!;
    expect(hideBtn).toBeTruthy();

    await act(async () => {
      hideBtn.click();
    });
    expect(useUiStore.getState().uiHidden).toBe(true);
    expect(host.querySelector('[role="tablist"]')).toBeNull();
    const restoreBtn = host.querySelector<HTMLButtonElement>('button[aria-label="Show interface"]')!;
    expect(restoreBtn).toBeTruthy();

    await act(async () => {
      restoreBtn.click();
    });
    expect(useUiStore.getState().uiHidden).toBe(false);
    expect(host.querySelector('[role="tablist"]')).toBeTruthy();
  });
});

describe("HomeInbox collapsible waiting inbox", () => {
  it("renders waiting items, collapses/expands, and submits an inline comment.add reply", async () => {
    const replies: InlineReplyPayload[] = [];
    const model = buildHomeInbox({
      canvases: [
        {
          canvasId: "prj_alpha",
          canvasTitle: "Acme Alpha",
          askedAgents: [
            {
              canvasId: "prj_alpha",
              canvasTitle: "Acme Alpha",
              sessionId: "ses_1",
              actorId: "usr_bot",
              actorName: "Acme Bot",
              question: "Ready to finalize layout?",
              threadId: "thr_ask",
              createdAt: "2026-11-19T12:00:00.000Z",
            },
          ],
        },
      ],
    });

    await act(async () => {
      root.render(
        h(HomeInbox, {
          actor,
          model,
          onReply: (payload) => {
            replies.push(payload);
          },
        }),
      );
    });

    expect(host.textContent).toContain("Waiting on you");
    expect(host.textContent).toContain("Ready to finalize layout?");

    const input = host.querySelector<HTMLInputElement>(".shell-home-inbox-input")!;
    const form = host.querySelector<HTMLFormElement>(".shell-home-inbox-reply")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "Yes, ship it");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(replies).toHaveLength(1);
    expect(replies[0]!.canvasId).toBe("prj_alpha");
    expect(replies[0]!.op.type).toBe("thread.reply");
    expect(replies[0]!.op.threadId).toBe("thr_ask");
    expect(replies[0]!.op.comment.body).toBe("Yes, ship it");

    // Collapsing hides the list cleanly.
    const toggle = host.querySelector<HTMLButtonElement>(".shell-home-inbox-head")!;
    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(host.querySelector(".shell-home-inbox-list")).toBeNull();
  });
});
