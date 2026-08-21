import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  type Cloud,
  type ExecResult,
  DEFAULT_LOCATION,
  ProvisionError,
  firebaseProjectIdFor,
  provision,
  readRemote,
  storageLocation,
} from "../src/provision.ts";

/**
 * The one-time dance (#69).
 *
 * Every process the dance spawns and every API call it makes goes through the
 * `Cloud` seam, so the whole script is exercised here without a Google account
 * anywhere near it — which is the point of the seam. What these tests are
 * really about is the two properties that make a ninety-second cloud script
 * survivable: it resumes where it died, and it never does twice what it has
 * already done.
 */

let home: string;
let root: string;

beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-provision-home-"));
  root = await fs.mkdtemp(path.join(os.tmpdir(), "isocan-provision-work-"));
});

afterEach(async () => {
  for (const dir of [home, root]) await fs.rm(dir, { recursive: true, force: true });
});

/* ── a Google that lives in a variable ──────────────────────────────────── */

interface FakeOptions {
  /** Does the Google Cloud project already exist? */
  projectExists?: boolean;
  billed?: boolean;
  /** Commands whose first matching invocation fails, to kill the dance. */
  fail?: RegExp;
  /** No terminal to hand over: `gcloud auth login` cannot prompt. */
  attachFails?: boolean;
  /** Commands that fail the first N times with a transient IAM answer. */
  flaky?: { match: RegExp; times: number; stderr: string };
  /** Identity Platform is a paid feature: no billing, no Auth from here. */
  authUninitializable?: boolean;
}

function fakeCloud(opts: FakeOptions = {}) {
  const commands: string[] = [];
  const requests: string[] = [];
  const envs: Record<string, string>[] = [];
  const ok = (stdout = ""): ExecResult => ({ status: 0, stdout, stderr: "" });
  const nope = (stderr = "not found"): ExecResult => ({ status: 1, stdout: "", stderr });

  const cloud: Cloud = {
    async exec(command, args, execOpts) {
      const line = [command, ...args].join(" ");
      commands.push(line);
      if (execOpts?.env) envs.push(execOpts.env);
      if (opts.fail?.test(line)) return nope("the cloud said no");
      if (opts.flaky?.match.test(line) && opts.flaky.times-- > 0) return nope(opts.flaky.stderr);
      if (/^gcloud auth list/.test(line)) return ok("host@example.com\n");
      if (/^gcloud auth print-access-token/.test(line)) return ok("ya29.token\n");
      if (/^gcloud projects describe/.test(line)) {
        return opts.projectExists ? ok("isocan-x") : nope();
      }
      if (/^gcloud firestore databases describe/.test(line)) return nope();
      if (/^gcloud billing projects describe/.test(line)) {
        return opts.billed === false ? ok("False\n") : ok("True\n");
      }
      if (/^gcloud iam service-accounts keys create/.test(line)) {
        // gcloud writes the key file itself; the dance only chmods it.
        const file = args[args.indexOf("create") + 1]!;
        await fs.writeFile(file, JSON.stringify({ type: "service_account" }));
        return ok();
      }
      return ok();
    },
    async attach(command, args) {
      commands.push(`<attached> ${[command, ...args].join(" ")}`);
      return opts.attachFails ? 1 : 0;
    },
    async request(method, url, _token, _body, quotaProject) {
      requests.push(
        `${method} ${url.replace(/^https:\/\//, "").split("?")[0]} quota=${quotaProject ?? "none"}`,
      );
      if (/webApps$/.test(url) && method === "GET") return { status: 200, body: { apps: [] } };
      if (/webApps$/.test(url) && method === "POST") {
        return {
          status: 200,
          body: { name: "operations/app", done: true, response: { name: "projects/1/webApps/a" } },
        };
      }
      if (/defaultBucket$/.test(url)) {
        // The bucket lives under a Google-owned domain, so only Firebase can
        // make one: GET says "not yet", POST makes it and names it.
        if (method === "GET") return { status: 404, body: { error: { message: "NOT_FOUND" } } };
        return {
          status: 200,
          body: { bucket: { name: "projects/isocan-x/buckets/isocan-x.firebasestorage.app" } },
        };
      }
      if (/identitytoolkit/.test(url)) {
        // A project that has never had Auth turned on has no config to patch.
        if (method === "GET") return { status: 404, body: { error: { message: "NOT_FOUND" } } };
        if (opts.authUninitializable && /initializeAuth/.test(url)) {
          return { status: 400, body: { error: { message: "BILLING_NOT_ENABLED" } } };
        }
        return { status: 200, body: {} };
      }
      if (/\/config$/.test(url)) {
        return { status: 200, body: { projectId: "isocan-x", apiKey: "AIza-fake" } };
      }
      return { status: 200, body: { done: true, response: {} } };
    },
    async sleep() {},
    now: () => "2026-08-20T00:00:00.000Z",
  };
  return { cloud, commands, requests, envs };
}

const options = (cloud: Cloud) => ({
  home,
  root,
  projectId: "prj_abc",
  title: "Kitchen Rebuild",
  cloud,
  say: () => {},
});

async function marker(): Promise<any> {
  return JSON.parse(await fs.readFile(path.join(root, ".isocan", "project.json"), "utf8"));
}

/* ── naming, which is the part with rules ───────────────────────────────── */

describe("the project id a canvas gets", () => {
  it("is recognizable, legal, and unique", () => {
    const id = firebaseProjectIdFor("Kitchen Rebuild", "a1b2c3");
    expect(id).toBe("isocan-kitchen-rebuild-a1b2c3");
    expect(id.length).toBeLessThanOrEqual(30);
  });

  it("stays inside Google's 30 characters however long the title is", () => {
    const id = firebaseProjectIdFor("A canvas about absolutely everything", "a1b2c3");
    expect(id.length).toBeLessThanOrEqual(30);
    expect(id).toMatch(/^[a-z][a-z0-9-]*[a-z0-9]$/);
  });

  it("survives a title with nothing usable in it", () => {
    expect(firebaseProjectIdFor("🎨 ✨", "a1b2c3")).toBe("isocan-canvas-a1b2c3");
    // A truncation that lands on a hyphen must not leave one dangling.
    expect(firebaseProjectIdFor("kitchen rebuild now", "a1b2c3")).toMatch(/[a-z0-9]-a1b2c3$/);
  });

  it("translates Firestore's multi-regions into bucket locations", () => {
    expect(storageLocation("nam5")).toBe("us");
    expect(storageLocation("eur3")).toBe("eu");
    expect(storageLocation("us-central1")).toBe("us-central1");
  });
});

/* ── the dance ──────────────────────────────────────────────────────────── */

describe("provisioning a canvas's remote", () => {
  it("runs the whole dance and leaves the marker saying where the canvas lives", async () => {
    const { cloud, commands, requests } = fakeCloud();
    const record = await provision(options(cloud));

    expect(record.firebaseProject).toMatch(/^isocan-kitchen-rebuild-/);
    expect(record.location).toBe(DEFAULT_LOCATION);
    expect(Object.keys(record.done)).toEqual([
      "tools",
      "account",
      "project",
      "apis",
      "firebase",
      "firestore",
      "credential",
      "signin",
      "webapp",
      "rules",
      "storage",
      "hosting",
      "marker",
    ]);
    expect(record.manual ?? {}).toEqual({});

    // The marker gains the remote stanza and keeps everything it already said.
    expect(await marker()).toEqual({
      projectId: "prj_abc",
      title: "Kitchen Rebuild",
      remote: { kind: "firestore", firebaseProject: record.firebaseProject },
    });

    // The credential is the daemon's own, and it never leaves the home.
    expect(record.keyFile).toBe(path.join(home, "remotes", `${record.firebaseProject}.key.json`));
    const mode = (await fs.stat(record.keyFile!)).mode & 0o777;
    expect(mode).toBe(0o600);
    expect(record.keyFile!.startsWith(root)).toBe(false);

    expect(commands.join("\n")).toContain(`gcloud projects create ${record.firebaseProject}`);
    expect(requests.join("\n")).toContain(":addFirebase");
    // A token from `gcloud auth print-access-token` is a PERSON's credential
    // and carries no project — the Firebase APIs 403 unless every call names
    // the project whose quota it is spending.
    for (const request of requests) expect(request).toContain(`quota=${record.firebaseProject}`);
    expect(record.hostingUrl).toBe(`https://${record.firebaseProject}.web.app`);
    expect(record.webConfig).toMatchObject({ apiKey: "AIza-fake" });
  });

  it("deploys rules and hosting as the host's own service account", async () => {
    const { cloud, commands, envs } = fakeCloud();
    const record = await provision(options(cloud));
    const deploys = commands.filter((line) => line.includes("deploy"));
    expect(deploys.some((line) => line.includes("--only firestore"))).toBe(true);
    expect(deploys.some((line) => line.includes("--only storage"))).toBe(true);
    expect(deploys.some((line) => line.includes("--only hosting"))).toBe(true);
    for (const line of deploys) expect(line).toContain(`--project ${record.firebaseProject}`);

    // firebase-tools prefers its own cached login to GOOGLE_APPLICATION_
    // CREDENTIALS, and will sit refusing to refresh a year-old user token
    // rather than notice the service account. A config directory of its own
    // leaves it nothing to prefer — and leaves the person's own
    // `firebase login` alone.
    const deployEnv = envs.find((env) => env.GOOGLE_APPLICATION_CREDENTIALS)!;
    expect(deployEnv.GOOGLE_APPLICATION_CREDENTIALS).toBe(record.keyFile);
    expect(deployEnv.XDG_CONFIG_HOME).toBe(
      path.join(home, "remotes", `${record.firebaseProject}.deploy`, "config"),
    );

    // The generated workspace is what firebase-tools reads: rules copied out
    // of this build, hosting pointed at the built app.
    const deployDir = path.join(home, "remotes", `${record.firebaseProject}.deploy`);
    const config = JSON.parse(await fs.readFile(path.join(deployDir, "firebase.json"), "utf8"));
    expect(config.firestore.rules).toBe("firestore.rules");
    expect(config.hosting.rewrites).toEqual([{ source: "**", destination: "/index.html" }]);
    // What goes up is a page that explains itself, NOT the local web app.
    // That app talks to a daemon at its own origin and there is no daemon
    // here, so serving it would hand out a link that renders a welcome screen
    // and then dies on its first API call (#73 brings the guest app).
    expect(config.hosting.public).toBe("public");
    const page = await fs.readFile(path.join(deployDir, "public", "index.html"), "utf8");
    expect(page).toContain("Nothing is shared here yet");
    expect(page).not.toContain("<script type=\"module\"");
    const rules = await fs.readFile(path.join(deployDir, "firestore.rules"), "utf8");
    expect(rules).toContain("match /canvases/{canvasId}");
    // Provisioning precedes minting: what it deploys lets nobody in.
    expect(rules).not.toMatch(/allow (read|write)[^;]*: if (?!false)/);
  });

  it("adopts a Google Cloud project that already exists rather than making a second", async () => {
    const { cloud, commands } = fakeCloud({ projectExists: true });
    await provision({ ...options(cloud), firebaseProject: "isocan-kept-one" });
    expect(commands.some((line) => line.startsWith("gcloud projects create"))).toBe(false);
    expect(commands.some((line) => line.includes("isocan-kept-one"))).toBe(true);
  });

  it("refuses to move a canvas that is already provisioned somewhere", async () => {
    const first = fakeCloud();
    const record = await provision(options(first.cloud));
    const second = fakeCloud();
    await expect(
      provision({ ...options(second.cloud), firebaseProject: "isocan-somewhere-else" }),
    ).rejects.toThrow(/already provisioned into/);
    expect(await readRemote(home, "prj_abc")).toMatchObject({
      firebaseProject: record.firebaseProject,
    });
  });
});

describe("a dance that dies halfway", () => {
  it("keeps what worked, and the next run picks up from there", async () => {
    const dying = fakeCloud({ fail: /firestore databases create/ });
    await expect(provision(options(dying.cloud))).rejects.toThrow(ProvisionError);

    const halfway = await readRemote(home, "prj_abc");
    expect(Object.keys(halfway!.done)).toEqual(["tools", "account", "project", "apis", "firebase"]);
    // Nothing claims the canvas is shared until it is.
    await expect(marker()).rejects.toThrow();

    const resumed = fakeCloud();
    const record = await provision(options(resumed.cloud));
    expect(record.firebaseProject).toBe(halfway!.firebaseProject);
    // The steps that already ran do not run again — no second project, no
    // second credential, no re-enabling of anything.
    expect(resumed.commands.some((line) => line.startsWith("gcloud projects create"))).toBe(false);
    expect(resumed.commands.some((line) => line.includes("firebasehosting.googleapis.com"))).toBe(
      false,
    );
    expect(record.done.marker).toBeTruthy();
  });

  it("does nothing at all when everything is already done", async () => {
    const { cloud } = fakeCloud();
    await provision(options(cloud));
    const again = fakeCloud();
    await provision(options(again.cloud));
    expect(again.commands).toEqual([]);
    expect(again.requests).toEqual([]);
  });
});

describe("when blobs have nowhere to go yet", () => {
  it("provisions everything free, says what billing is for, and finishes", async () => {
    const { cloud, requests } = fakeCloud({ billed: false });
    const record = await provision(options(cloud));

    expect(record.storageBucket).toBeUndefined();
    expect(record.done.storage).toBeUndefined();
    expect(record.manual?.storage).toMatch(/billing account/);
    expect(requests.some((line) => line.includes("defaultBucket"))).toBe(false);

    // A missing bucket is not a broken canvas: hosting, rules and the marker
    // all landed, so the remote is real — it just cannot serve bytes yet.
    expect(record.done.hosting).toBeTruthy();
    expect(record.done.marker).toBeTruthy();
    expect(record.hostingUrl).toBeTruthy();
  });

  it("retries only the pending step once billing is linked", async () => {
    const first = fakeCloud({ billed: false });
    await provision(options(first.cloud));

    const second = fakeCloud({ billed: true });
    const record = await provision(options(second.cloud));
    expect(record.storageBucket).toBe("isocan-x.firebasestorage.app");
    expect(record.done.storage).toBeTruthy();
    expect(record.manual?.storage).toBeUndefined();
    // Only the storage step, and the deploy it owns, ran the second time.
    expect(second.commands.some((line) => line.includes("--only hosting"))).toBe(false);
    expect(second.commands.some((line) => line.startsWith("gcloud projects create"))).toBe(false);
  });

});

describe("anonymous sign-in, which is how a link admits anybody", () => {
  it("brings Auth into existence before patching it", async () => {
    // A project that has never had Auth turned on answers
    // CONFIGURATION_NOT_FOUND to the patch — not "anonymous is off" — so the
    // config has to be created first or the step never succeeds, billing or no.
    const { cloud, requests } = fakeCloud();
    const record = await provision(options(cloud));
    const identity = requests.filter((line) => line.includes("identitytoolkit"));
    expect(identity[0]).toMatch(/GET .*\/config/);
    expect(identity[1]).toMatch(/POST .*identityPlatform:initializeAuth/);
    expect(identity[2]).toMatch(/PATCH .*\/config/);
    expect(record.done.signin).toBeTruthy();
  });

  it("hands back the free click when Identity Platform wants billing", async () => {
    const { cloud } = fakeCloud({ authUninitializable: true });
    const record = await provision(options(cloud));
    expect(record.done.signin).toBeUndefined();
    expect(record.manual?.signin).toMatch(/One click, free/);
    expect(record.manual?.signin).toMatch(/billing account does it from here instead/);
    // And the rest of the remote still lands.
    expect(record.done.marker).toBeTruthy();
  });
});

describe("IAM saying ask me again", () => {
  it("backs off and retries the binding rather than failing the dance", async () => {
    // Binding three roles is three read-modify-writes of one policy, and they
    // collide — with each other, and with whatever Google is still doing to a
    // project it has just finished making.
    const { cloud, commands } = fakeCloud({
      flaky: {
        match: /add-iam-policy-binding/,
        times: 2,
        stderr: "There were concurrent policy changes. The request's ETag did not match",
      },
    });
    const record = await provision(options(cloud));
    expect(record.done.credential).toBeTruthy();
    expect(commands.filter((line) => line.includes("add-iam-policy-binding")).length).toBe(5);
  });

  it("gives up on an answer that is not going to change", async () => {
    const { cloud } = fakeCloud({ fail: /add-iam-policy-binding/ });
    await expect(provision(options(cloud))).rejects.toThrow(/add-iam-policy-binding/);
  });
});

describe("the Google account", () => {
  it("is checked by asking for a token, not by reading a cached name", async () => {
    // gcloud names an ACTIVE account long after its credentials went stale;
    // every later step spends a token, so a token is what gets checked.
    const { cloud, commands } = fakeCloud({ fail: /^gcloud auth print-access-token/ });
    await expect(provision(options(cloud))).rejects.toThrow(/still cannot mint a token/);
    expect(commands.some((line) => line === "<attached> gcloud auth login")).toBe(true);
  });

  it("says to go run the login itself when there is no terminal to prompt in", async () => {
    const { cloud } = fakeCloud({ fail: /print-access-token|auth login/, attachFails: true });
    await expect(provision(options(cloud))).rejects.toThrow(/run it yourself/);
  });
});

describe("the tools the dance needs", () => {
  it("names the one that is missing instead of failing in Google's words", async () => {
    const { cloud } = fakeCloud({ fail: /^gcloud version/ });
    await expect(provision(options(cloud))).rejects.toThrow(/gcloud.*not on your PATH/s);
  });
});
