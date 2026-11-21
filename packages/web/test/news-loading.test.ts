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

import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WhatsNew } from "../src/components/WhatsNew.tsx";
import { useUnreadNews } from "../src/lib/news.ts";
import { useUiStore } from "../src/stores/uiStore.ts";

const fetchNews = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/api.ts", () => ({ fetchNews }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const day = { day: "2026-11-18", title: "Acme update", items: ["A clearer canvas."] };
const seenKey = "isocan.news.seen";
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  localStorage.clear();
  fetchNews.mockReset().mockResolvedValue({ days: [day] });
  useUiStore.setState({ newsOpen: false });
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  act(() => root.unmount());
  host.remove();
  await vi.dynamicImportSettled();
  vi.restoreAllMocks();
});

it("waits until opened, marks the fetched day read, and refreshes when reopened", async () => {
  await act(async () => root.render(h(WhatsNew)));
  expect(fetchNews).not.toHaveBeenCalled();
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(localStorage.getItem(seenKey)).toBeNull();

  await act(async () => {
    useUiStore.getState().setNewsOpen(true);
    await vi.dynamicImportSettled();
  });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain(day.items[0]);
  expect(fetchNews).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(seenKey)).toBe(day.day);

  act(() => host.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click());
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  const next = { ...day, day: "2026-11-19", items: ["Another Acme update."] };
  fetchNews.mockResolvedValueOnce({ days: [next] });
  await act(async () => useUiStore.getState().setNewsOpen(true));
  expect(host.textContent).toContain(next.items[0]);
  expect(fetchNews).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem(seenKey)).toBe(next.day);
});

it("still shows release notes when browser storage refuses writes", async () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage refused"); });
  useUiStore.setState({ newsOpen: true });
  await act(async () => {
    root.render(h(WhatsNew));
    await vi.dynamicImportSettled();
  });
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain(day.items[0]);
  expect(localStorage.getItem(seenKey)).toBeNull();
});

it("keeps the unread indicator available without opening the dialog", async () => {
  function Count() { return h("output", null, useUnreadNews()); }
  localStorage.setItem(seenKey, "2026-11-17");
  await act(async () => root.render(h(Count)));
  expect(host.textContent).toBe("1");
  expect(localStorage.getItem(seenKey)).toBe("2026-11-17");
});
