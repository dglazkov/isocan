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

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import setup, { buildTestCli } from "./cli-build.ts";
// @ts-expect-error plain Node release builder
import * as release from "../scripts/release.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

describe("the CLI built for a test run", () => {
  it("isolates concurrent runs and leaves the other build intact when one closes", async () => {
    const first = await buildTestCli(root);
    let second: Awaited<ReturnType<typeof buildTestCli>> | undefined;
    try {
      second = await buildTestCli(root);
      expect(first.bin).not.toBe(second.bin);
      expect(first.bin.startsWith(path.join(root, ".isocan", "test-cli-"))).toBe(true);
      await fs.access(first.bin);
      await fs.access(second.bin);
      await first.close();
      await expect(fs.access(first.bin)).rejects.toMatchObject({ code: "ENOENT" });
      await fs.access(second.bin);
    } finally {
      await first.close();
      await second?.close();
    }
  });

  it("fails the run and removes its scratch directory when the build fails", async () => {
    let output = "";
    const build = vi.spyOn(release, "buildCliBundle").mockImplementationOnce(async (out: string) => {
      output = out;
      throw new Error("synthetic build failure");
    });
    try {
      await expect(buildTestCli(root)).rejects.toThrow("synthetic build failure");
      expect(output.startsWith(path.join(root, ".isocan", "test-cli-"))).toBe(true);
      await expect(fs.access(output)).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      build.mockRestore();
    }
  });

  it("uses source in watch mode so a rerun cannot reuse an old build", async () => {
    const provide = vi.fn();
    const close = await setup({ config: { root, watch: true }, provide });
    expect(close).toBeUndefined();
    expect(provide).toHaveBeenCalledWith("isocanCli", path.join(root, "packages/cli/bin/isocan.js"));
  });
});
