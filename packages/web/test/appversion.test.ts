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

import { describe, expect, it } from "vitest";
import { isOutdated, mayReloadUnseen, runningBundle, servedBundle } from "../src/lib/appversion.ts";

/**
 * A tab notices an upgrade without anything being versioned: Vite hashes the
 * entry bundle by content, so "which bundle is the server pointing at now"
 * answers "is my app still the app".
 */
describe("noticing that the app moved on", () => {
  it("reads the bundle this tab is running from its own module URL", () => {
    expect(runningBundle("http://127.0.0.1:4441/assets/index-7PNG8ZF_.js")).toBe(
      "index-7PNG8ZF_.js",
    );
    expect(runningBundle("http://127.0.0.1:4441/src/main.tsx")).toBeNull(); // dev
  });

  it("reads the bundle the server is pointing at, out of its index.html", () => {
    const html = `<!doctype html><html><head>
      <script type="module" crossorigin src="/assets/index-DcRBOtET.js"></script>
      <link rel="stylesheet" crossorigin href="/assets/index-A8xANLz8.css">
    </head><body><div id="root"></div></body></html>`;
    expect(servedBundle(html)).toBe("index-DcRBOtET.js");
    expect(servedBundle("<html><body>nothing here</body></html>")).toBeNull();
  });

  it("only calls it outdated when both are known and they differ", () => {
    expect(isOutdated("index-old.js", "index-new.js")).toBe(true);
    expect(isOutdated("index-same.js", "index-same.js")).toBe(false);
    // An unknown is never an update: no nagging in dev, or on a failed fetch.
    expect(isOutdated(null, "index-new.js")).toBe(false);
    expect(isOutdated("index-old.js", null)).toBe(false);
  });
});

describe("reloading a tab nobody is looking at", () => {
  const idle = { hidden: true, unsynced: 0, unfinished: false };
  it("reloads a hidden tab with nothing in hand", () => {
    expect(mayReloadUnseen(idle)).toBe(true);
  });
  it("leaves a visible tab to its pill", () => {
    expect(mayReloadUnseen({ ...idle, hidden: false })).toBe(false);
  });
  it("waits for unconfirmed writes and never drops ink or words", () => {
    expect(mayReloadUnseen({ ...idle, unsynced: 2 })).toBe(false);
    expect(mayReloadUnseen({ ...idle, unfinished: true })).toBe(false);
  });
});
