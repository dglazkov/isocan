import { promises as fs } from "node:fs";
import path from "node:path";
import type { TestProject } from "vitest/node";
// @ts-expect-error plain Node release builder, shared with publication
import { buildCliBundle } from "../scripts/release.mjs";

declare module "vitest" {
  export interface ProvidedContext {
    isocanCli: string;
  }
}

/** A fresh release-format CLI for this run, away from the bundle tests' dist.
 * Keep it under the checkout so packageRoot still finds the real manifest,
 * web build, scripts and source launcher used by child daemons. */
export async function buildTestCli(root: string): Promise<{ bin: string; close: () => Promise<void> }> {
  const scratch = path.join(root, ".isocan");
  await fs.mkdir(scratch, { recursive: true });
  const out = await fs.mkdtemp(path.join(scratch, "test-cli-"));
  const close = () => fs.rm(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  try {
    const { outfile } = await buildCliBundle(out);
    return { bin: outfile, close };
  } catch (error) {
    await close();
    throw error;
  }
}

type Project = Pick<TestProject, "provide"> & { config: Pick<TestProject["config"], "root" | "watch"> };

export default async function setup(project: Project): Promise<(() => Promise<void>) | void> {
  // A watch rerun must see source edits immediately, never a startup snapshot.
  if (project.config.watch) {
    project.provide("isocanCli", path.join(project.config.root, "packages/cli/bin/isocan.js"));
    return;
  }
  const cli = await buildTestCli(project.config.root);
  project.provide("isocanCli", cli.bin);
  return cli.close;
}
