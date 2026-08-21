import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { paths } from "@isocan/server";
import { writeMarker } from "./binding.ts";

/**
 * The one-time dance (#69).
 *
 * Nothing about installing isocan or using it day to day involves Google. The
 * whole Firebase apparatus appears the first time someone runs `isocan share`,
 * at the moment they want it, and never again — which is why this file is a
 * script of steps rather than a subsystem. It creates a Google Cloud project,
 * turns it into a Firebase project, gives the host daemon a credential of its
 * own, deploys the canned (and deliberately closed) rules, and puts the
 * canvas's address on Hosting. About ninety seconds.
 *
 * Two properties do all the work of making that survivable:
 *
 * **Resumable.** Every step records itself in the home the moment it finishes,
 * so a dance that dies at step seven — a dropped network, a browser tab that
 * never came back, an ^C — resumes at step seven. The record lives beside the
 * credential under `~/.isocan/remotes`, keyed by CANVAS, because it is a canvas
 * that gets shared; several canvases may name one Firebase project later.
 *
 * **Idempotent.** Steps do not trust the record either. Each one asks the cloud
 * what is already true and tolerates "already exists", so a record lost to an
 * `rm -rf` costs a re-run, not a second project.
 *
 * The seam for tests is `Cloud`: every process this file spawns and every API
 * call it makes goes through it, so the whole script can be driven against a
 * fake without a Google account anywhere near it.
 */

/** Pinned so a machine that has never run this gets a version we have seen
 * work; unpinned, `npx` would hand a first-time host whatever shipped today. */
export const FIREBASE_TOOLS = "firebase-tools@15";

/** Firestore's default multi-region. `isocan share --location` overrides it —
 * where the bytes live is the host's decision, not ours. */
export const DEFAULT_LOCATION = "nam5";

/** Turned on before anything needs them, in one call, on the free tier. */
const CORE_SERVICES = [
  "firebase.googleapis.com",
  "firestore.googleapis.com",
  "firebaserules.googleapis.com",
  "firebasehosting.googleapis.com",
  "identitytoolkit.googleapis.com",
  "cloudbilling.googleapis.com",
  "iam.googleapis.com",
  // Enabled on a new project already, but it is what makes the project
  // nameable as a quota project — and nothing works if it is not.
  "serviceusage.googleapis.com",
];

/** Enabled inside the storage step instead, once billing is known to be
 * there: an API that refuses to enable must not take the rest down with it. */
const STORAGE_SERVICES = ["storage.googleapis.com", "firebasestorage.googleapis.com"];

/**
 * What the host daemon's own credential may do: write the mirror (datastore),
 * publish verified blobs (storage), and deploy rules and Hosting (firebase).
 * Not owner — the daemon should not be able to delete the project it lives in.
 */
const ROLES = ["roles/firebase.admin", "roles/datastore.user", "roles/storage.admin"];

const FIREBASE_API = "https://firebase.googleapis.com";
const IDENTITY_API = "https://identitytoolkit.googleapis.com";
const STORAGE_API = "https://firebasestorage.googleapis.com";

/** The service account the daemon speaks as. One per Firebase project. */
const HOST_ACCOUNT = "isocan-host";

export class ProvisionError extends Error {}

/* ── the record ─────────────────────────────────────────────────────────── */

/**
 * One Firebase project, and how far its provisioning got.
 *
 * Keyed by the FIREBASE project, not by a canvas. Provisioning is a property
 * of the place, and the place holds as many canvases as the host puts in it —
 * that is what `canvases/{projectId}` in Firestore and `/c/{projectId}` in the
 * guest link are for. Keying this by canvas is how the second `isocan share`
 * ended up minting a second Google Cloud project, against a design that says
 * the dance happens "the moment you want it, and never again".
 *
 * Which canvas lives in which project is the marker's business, not this
 * file's: it travels with the repo, where a clone can read it.
 */
export interface RemoteRecord {
  kind: "firestore";
  firebaseProject: string;
  location: string;
  /** Step name → when it finished. A step missing from here is a step the
   * next run does. */
  done: Record<string, string>;
  /**
   * The canvases this home has put in this project, and when (#70).
   *
   * The marker in the repo is still authoritative for WHICH project hosts a
   * canvas — it travels with the checkout, so a clone arrives knowing. This is
   * the other question, the one only the home can answer: which canvases is
   * this machine the HOST of. The daemon needs that one, because hosting is
   * what makes it the mirror's writer, and a teammate's clone carries a marker
   * saying where the canvas lives while holding neither the credential nor the
   * authority to write there.
   */
  canvases?: Record<string, { sharedAt: string }>;
  /** The Google account that provisioned it, for saying so. */
  account?: string;
  /** Where the host daemon's service-account key landed (mode 600). */
  keyFile?: string;
  storageBucket?: string;
  hostingUrl?: string;
  /** The public Firebase config the guest app needs to talk to this project.
   * Public by design — it is an address, not a permission. */
  webConfig?: Record<string, unknown>;
  /** Step name → what the dance could not do for you, and how you do it.
   * Steps that leave a note here are steps that did not mark themselves
   * done, so the next `isocan share` tries them again. */
  manual?: Record<string, string>;
}

export async function readRemote(
  home: string,
  firebaseProject: string,
): Promise<RemoteRecord | null> {
  try {
    const raw = JSON.parse(
      await fs.readFile(paths.remoteFile(home, firebaseProject), "utf8"),
    ) as RemoteRecord;
    return raw && typeof raw.firebaseProject === "string" ? raw : null;
  } catch {
    return null;
  }
}

export async function writeRemote(home: string, record: RemoteRecord): Promise<void> {
  // 700: the credential lives in this directory, and so does everything that
  // says where to spend it.
  await fs.mkdir(paths.remotesDir(home), { recursive: true, mode: 0o700 });
  await fs.writeFile(
    paths.remoteFile(home, record.firebaseProject),
    `${JSON.stringify(record, null, 2)}\n`,
    { mode: 0o600 },
  );
}

/** Every Firebase project this home has provisioned, oldest name first. The
 * directory listing IS the registry — there is no separate index to drift. */
export async function listRemotes(home: string): Promise<RemoteRecord[]> {
  let names: string[];
  try {
    names = await fs.readdir(paths.remotesDir(home));
  } catch {
    return [];
  }
  const records: RemoteRecord[] = [];
  for (const name of names.sort()) {
    // `<project>.key.json` and `<project>.deploy` live here too.
    if (!name.endsWith(".json") || name.endsWith(".key.json")) continue;
    const record = await readRemote(home, name.slice(0, -".json".length));
    if (record) records.push(record);
  }
  return records;
}

/* ── pure helpers, so the naming rules are testable without a cloud ─────── */

/**
 * A Google Cloud project id for a HOST's canvases: globally unique, 6–30
 * characters, lowercase, starting with a letter.
 *
 * Deliberately not named after a canvas. This project holds however many
 * canvases the host shares, so borrowing the first one's title would be a name
 * that starts out charming and becomes a lie — "isocan-kitchen-rebuild"
 * quietly hosting nine other things. What a host needs to recognize in a
 * console list is that the project is isocan's; the tail is there because
 * project ids are claimed worldwide, first come.
 */
export function firebaseProjectId(suffix: string): string {
  return `isocan-${suffix}`;
}

/** Eight characters of tail. Not a secret — a tiebreaker against the whole
 * world's project ids, so it is worth more than a couple of them. */
export function projectSuffix(): string {
  return randomBytes(4).toString("hex");
}

/**
 * Cloud Storage and Firestore spell the same places differently: Firestore's
 * multi-regions (`nam5`, `eur3`) are `us` and `eu` to a bucket. Regional names
 * (`us-central1`) mean the same thing to both.
 */
export function storageLocation(firestoreLocation: string): string {
  const multi: Record<string, string> = { nam5: "us", eur3: "eu", asia1: "asia" };
  return multi[firestoreLocation] ?? firestoreLocation;
}

/* ── the seam ───────────────────────────────────────────────────────────── */

export interface ExecResult {
  status: number;
  stdout: string;
  stderr: string;
}

export interface Cloud {
  /** Run a command and capture it. Never throws — a non-zero status is data. */
  exec(
    command: string,
    args: string[],
    opts?: { cwd?: string; env?: Record<string, string> },
  ): Promise<ExecResult>;
  /** Hand the terminal over: `gcloud auth login` opens a browser and asks. */
  attach(command: string, args: string[]): Promise<number>;
  request(
    method: string,
    url: string,
    token: string,
    body?: unknown,
    /** Whose quota to spend. A token minted by `gcloud auth print-access-token`
     * is a PERSON's credential and carries no project of its own, and the
     * Firebase APIs refuse to guess one — so every call names the project it
     * is about. */
    quotaProject?: string,
  ): Promise<{ status: number; body: any }>;
  sleep(ms: number): Promise<void>;
  now(): string;
}

export const systemCloud: Cloud = {
  exec(command, args, opts) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        ...(opts?.cwd !== undefined ? { cwd: opts.cwd } : {}),
        env: { ...process.env, ...opts?.env },
        shell: process.platform === "win32",
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.stderr.on("data", (chunk) => (stderr += chunk));
      child.on("error", (err) => resolve({ status: 127, stdout, stderr: err.message }));
      child.on("close", (code) => resolve({ status: code ?? 1, stdout, stderr }));
    });
  },
  attach(command, args) {
    return new Promise((resolve) => {
      const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
      });
      child.on("error", () => resolve(127));
      child.on("close", (code) => resolve(code ?? 1));
    });
  },
  async request(method, url, token, body, quotaProject) {
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(quotaProject ? { "x-goog-user-project": quotaProject } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      // A non-JSON body is still worth reporting verbatim in the error.
    }
    return { status: res.status, body: parsed };
  },
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => new Date().toISOString(),
};

/* ── the run ────────────────────────────────────────────────────────────── */

export interface ProvisionOptions {
  home: string;
  /** The bound directory whose marker gains the `remote` stanza. */
  root: string;
  /** The canvas being shared. */
  projectId: string;
  title: string;
  location?: string;
  /** Adopt an existing Firebase project instead of creating one — a retry
   * after a half-finished dance, or a second canvas in a project you keep. */
  firebaseProject?: string;
  cloud?: Cloud;
  say?: (line: string) => void;
}

interface Run extends ProvisionOptions {
  cloud: Cloud;
  say: (line: string) => void;
  record: RemoteRecord;
  token?: string;
}

/** "pending" — the step could not finish for a reason the host can fix, said
 * so, and will be tried again by the next `isocan share`. */
type Outcome = void | "pending";

interface Step {
  name: string;
  says: string;
  /** Runs for every canvas, not once for the project — so it is never
   * recorded as done, because "done" is a fact about the project and this is
   * a fact about a canvas. The second canvas into a provisioned project runs
   * only these. */
  perCanvas?: true;
  run: (run: Run) => Promise<Outcome>;
}

export const STEPS: Step[] = [
  {
    name: "tools",
    says: "checking the tools (first run downloads the Firebase CLI)",
    async run(run) {
      const gcloud = await run.cloud.exec("gcloud", ["version"]);
      if (gcloud.status !== 0) {
        throw new ProvisionError(
          "the Google Cloud CLI (`gcloud`) is not on your PATH.\n" +
            "  Install it — https://cloud.google.com/sdk/docs/install — then run `isocan share` again.",
        );
      }
      const firebase = await run.cloud.exec("npx", ["--yes", FIREBASE_TOOLS, "--version"]);
      if (firebase.status !== 0) {
        throw new ProvisionError(
          `could not run ${FIREBASE_TOOLS} through npx:\n${indent(firebase.stderr || firebase.stdout)}`,
        );
      }
    },
  },
  {
    name: "account",
    says: "checking your Google account",
    async run(run) {
      // `gcloud auth list` will happily name an ACTIVE account whose
      // credentials expired months ago — the name is cached, the token is not.
      // So the only honest check is asking for a token, which is the thing
      // every later step actually spends.
      const named = async () =>
        (
          await gcloud(run, ["auth", "list", "--filter=status:ACTIVE", "--format=value(account)"])
        )
          .split("\n")[0]
          ?.trim() ?? "";
      let who = await named();
      let probe = await run.cloud.exec("gcloud", ["auth", "print-access-token"]);
      if (!who || probe.status !== 0) {
        run.say(
          who
            ? `    ${who} needs to sign in again — opening a browser tab`
            : "    no account yet — opening a browser tab to sign in",
        );
        const code = await run.cloud.attach("gcloud", ["auth", "login"]);
        if (code !== 0) {
          throw new ProvisionError(
            "`gcloud auth login` did not complete. It needs a terminal it can prompt in — " +
              "run it yourself, then run `isocan share` again.",
          );
        }
        who = await named();
        probe = await run.cloud.exec("gcloud", ["auth", "print-access-token"]);
        if (probe.status !== 0) {
          throw new ProvisionError(
            `gcloud still cannot mint a token:\n${indent(probe.stderr || probe.stdout)}`,
          );
        }
      }
      if (who) run.say(`    signed in as ${who}`);
      if (who) run.record.account = who;
      run.token = probe.stdout.trim();
    },
  },
  {
    name: "project",
    says: "creating the Google Cloud project",
    async run(run) {
      const id = run.record.firebaseProject;
      const describe = await run.cloud.exec("gcloud", [
        "projects",
        "describe",
        id,
        "--format=value(projectId)",
      ]);
      if (describe.status === 0) {
        run.say(`    ${id} already exists — using it`);
        return;
      }
      await gcloud(
        run,
        ["projects", "create", id, "--name", displayName(run.title), "--quiet"],
        { tolerate: /already (exists|in use)|ALREADY_EXISTS/i },
      );
      run.say(`    ${id}`);
    },
  },
  {
    name: "apis",
    says: "turning on Firestore, Hosting, rules and anonymous sign-in",
    async run(run) {
      await gcloud(run, [
        "services",
        "enable",
        ...CORE_SERVICES,
        "--project",
        run.record.firebaseProject,
        "--quiet",
      ]);
    },
  },
  {
    name: "firebase",
    says: "adding Firebase to the project",
    async run(run) {
      const id = run.record.firebaseProject;
      const started = await api(
        run,
        "POST",
        `${FIREBASE_API}/v1beta1/projects/${id}:addFirebase`,
        {},
        // 409 is the honest answer to "add Firebase to a Firebase project".
        { tolerate: [409] },
      );
      if (started) await settle(run, started);
    },
  },
  {
    name: "firestore",
    says: "creating the Firestore database",
    async run(run) {
      const id = run.record.firebaseProject;
      const describe = await run.cloud.exec("gcloud", [
        "firestore",
        "databases",
        "describe",
        "--database=(default)",
        "--project",
        id,
        "--format=value(name)",
      ]);
      if (describe.status === 0) return;
      await gcloud(
        run,
        [
          "firestore",
          "databases",
          "create",
          "--location",
          run.record.location,
          "--type=firestore-native",
          "--project",
          id,
          "--quiet",
        ],
        { tolerate: /already exists|ALREADY_EXISTS/i },
      );
    },
  },
  {
    name: "credential",
    says: "minting the host daemon's own credential",
    async run(run) {
      const id = run.record.firebaseProject;
      const email = `${HOST_ACCOUNT}@${id}.iam.gserviceaccount.com`;
      await gcloud(
        run,
        [
          "iam",
          "service-accounts",
          "create",
          HOST_ACCOUNT,
          "--display-name",
          "isocan host daemon",
          "--project",
          id,
          "--quiet",
        ],
        { tolerate: /already exists|ALREADY_EXISTS/i },
      );
      for (const role of ROLES) {
        // A service account is eventually consistent with IAM: the binding
        // that runs a second after the create sometimes cannot see it yet.
        await withRetry(run, () =>
          gcloud(run, [
            "projects",
            "add-iam-policy-binding",
            id,
            "--member",
            `serviceAccount:${email}`,
            "--role",
            role,
            "--condition=None",
            "--format=none",
            "--quiet",
          ]),
        );
      }
      const keyFile = paths.remoteKeyFile(run.home, id);
      if (!(await fileExists(keyFile))) {
        await fs.mkdir(paths.remotesDir(run.home), { recursive: true, mode: 0o700 });
        await gcloud(run, [
          "iam",
          "service-accounts",
          "keys",
          "create",
          keyFile,
          "--iam-account",
          email,
          "--project",
          id,
          "--quiet",
        ]);
        await fs.chmod(keyFile, 0o600).catch(() => {});
      }
      run.record.keyFile = keyFile;
    },
  },
  {
    name: "signin",
    says: "turning on anonymous sign-in",
    async run(run) {
      const id = run.record.firebaseProject;
      // Guests are admitted by a link, not by an account: the browser signs in
      // anonymously and silently, and the capability token does the rest.
      //
      // A project that has never had Auth turned on has no config to patch —
      // it answers CONFIGURATION_NOT_FOUND, not "anonymous is off" — so the
      // config has to be brought into existence first. That call is Identity
      // Platform's, and Identity Platform is a paid feature, which is the one
      // place this dance asks a Spark-plan host for a click.
      const config = await api(
        run,
        "GET",
        `${IDENTITY_API}/admin/v2/projects/${id}/config`,
        undefined,
        { tolerate: [400, 403, 404] },
      );
      if (!config) {
        const started = await api(
          run,
          "POST",
          `${IDENTITY_API}/v2/projects/${id}/identityPlatform:initializeAuth`,
          {},
          { tolerate: [400, 403, 404, 409] },
        );
        if (!started) {
          return note(
            run,
            "signin",
            "anonymous sign-in is what admits someone holding a link, and this project " +
              "has never had Auth turned on. One click, free: " +
              `https://console.firebase.google.com/project/${id}/authentication/providers ` +
              "(Anonymous → Enable). Linking a billing account does it from here instead. " +
              "Either way, run `isocan share` again afterwards.",
          );
        }
      }
      const enabled = await api(
        run,
        "PATCH",
        `${IDENTITY_API}/admin/v2/projects/${id}/config?updateMask=signIn.anonymous.enabled`,
        { signIn: { anonymous: { enabled: true } } },
        { tolerate: [400, 403, 404] },
      );
      if (enabled) return;
      return note(
        run,
        "signin",
        "Auth is on, but anonymous sign-in would not enable from here — turn it on at " +
          `https://console.firebase.google.com/project/${id}/authentication/providers ` +
          "(Anonymous → Enable), then run `isocan share` again",
      );
    },
  },
  {
    name: "webapp",
    says: "registering the web app",
    async run(run) {
      const id = run.record.firebaseProject;
      const existing = await api(run, "GET", `${FIREBASE_API}/v1beta1/projects/${id}/webApps`);
      let app = existing?.apps?.[0];
      if (!app) {
        const started = await api(run, "POST", `${FIREBASE_API}/v1beta1/projects/${id}/webApps`, {
          displayName: displayName(run.title),
        });
        app = await settle(run, started);
      }
      if (!app?.name) throw new ProvisionError("Firebase did not return a web app");
      run.record.webConfig = await api(run, "GET", `${FIREBASE_API}/v1beta1/${app.name}/config`);
    },
  },
  {
    name: "rules",
    says: "deploying the security rules",
    async run(run) {
      await writeDeployWorkspace(run);
      await firebaseDeploy(run, ["--only", "firestore"]);
    },
  },
  {
    name: "storage",
    says: "creating the bucket blobs live in",
    async run(run) {
      const id = run.record.firebaseProject;
      // Cloud Storage for Firebase needs a billing account (the Blaze plan);
      // Firestore and Hosting do not. So the dance provisions everything free
      // first and asks about billing here, where the answer matters — and a
      // "no" is a note, not a failure. The canvas shares without it; what it
      // cannot do yet is show guests the bytes of an item.
      const billing = await run.cloud.exec("gcloud", [
        "billing",
        "projects",
        "describe",
        id,
        "--format=value(billingEnabled)",
      ]);
      if (billing.status !== 0 || !/true/i.test(billing.stdout)) {
        return note(
          run,
          "storage",
          "blobs need Cloud Storage, which needs a billing account. Link one at " +
            `https://console.firebase.google.com/project/${id}/usage/details ` +
            "(the free tier still covers a canvas of this size), then run `isocan share` again.",
        );
      }
      await gcloud(run, ["services", "enable", ...STORAGE_SERVICES, "--project", id, "--quiet"]);
      // Not `gcloud storage buckets create`: the bucket a Firebase project
      // keeps its blobs in lives under `firebasestorage.app`, a domain Google
      // owns, so raw Cloud Storage refuses to make one there ("another user
      // owns the domain"). Firebase's own default-bucket call is the door —
      // and it registers the bucket with Firebase in the same breath.
      const url = `${STORAGE_API}/v1beta/projects/${id}/defaultBucket`;
      const read = () => api(run, "GET", url, undefined, { tolerate: [400, 403, 404] });
      let info = await read();
      if (!info?.bucket?.name) {
        const made = await api(
          run,
          "POST",
          url,
          { location: storageLocation(run.record.location) },
          { tolerate: [400, 409] },
        );
        info = made?.bucket?.name ? made : await read();
      }
      const bucket = String(info?.bucket?.name ?? "").split("/").pop();
      if (!bucket) {
        return note(
          run,
          "storage",
          "the blob bucket could not be created from here — make one at " +
            `https://console.firebase.google.com/project/${id}/storage ` +
            "(any location), then run `isocan share` again",
        );
      }
      run.record.storageBucket = bucket;
      await writeDeployWorkspace(run);
      await firebaseDeploy(run, ["--only", "storage"]);
    },
  },
  {
    name: "hosting",
    says: "putting the canvas's address up",
    async run(run) {
      // NOT the local web app, though it is built and sitting right there.
      // That app talks to a daemon at its own origin and there is no daemon
      // here, so serving it would hand out a link that renders a welcome
      // screen and then dies on its first API call — a page that looks alive
      // and is not, which is the one outcome #68 rules out by name. The guest
      // app that belongs at this address arrives with #73; until it does, the
      // address explains itself.
      await writeDeployWorkspace(run);
      await firebaseDeploy(run, ["--only", "hosting"]);
      run.record.hostingUrl = `https://${run.record.firebaseProject}.web.app`;
    },
  },
  {
    name: "marker",
    says: "recording the remote in this directory",
    perCanvas: true,
    async run(run) {
      await writeMarker(run.root, {
        projectId: run.projectId,
        title: run.title,
        remote: { kind: "firestore", firebaseProject: run.record.firebaseProject },
      });
      // And in the home, where the daemon can read it. The marker says where
      // the canvas lives; this says that WE are the ones who put it there —
      // which is the fact that makes this daemon its mirror's writer (#70).
      run.record.canvases = {
        ...run.record.canvases,
        [run.projectId]: { sharedAt: run.record.canvases?.[run.projectId]?.sharedAt ?? run.cloud.now() },
      };
    },
  },
];

/**
 * Run the dance, from wherever it last got to. Returns the record — including
 * `manual`, the things it could not do for you.
 */
export async function provision(opts: ProvisionOptions): Promise<RemoteRecord> {
  const cloud = opts.cloud ?? systemCloud;
  const say = opts.say ?? ((line: string) => console.error(line));
  const record = await resolveRemote(opts);
  if (opts.location && opts.location !== record.location && record.done.firestore) {
    // Firestore's database location cannot be changed once the database
    // exists, and the database belongs to the project — so where the bytes
    // live is a decision the host makes once, not once per canvas.
    throw new ProvisionError(
      `${record.firebaseProject} keeps its data in ${record.location}, and Firestore ` +
        "cannot be moved after the fact — `isocan share --firebase-project <new>` " +
        `to put this canvas somewhere in ${opts.location} instead`,
    );
  }
  const run: Run = { ...opts, cloud, say, record };

  for (const step of STEPS) {
    if (!step.perCanvas && record.done[step.name]) continue;
    say(`  ${step.says}…`);
    try {
      const outcome = await step.run(run);
      if (outcome !== "pending" && !step.perCanvas) {
        record.done[step.name] = cloud.now();
        if (record.manual) delete record.manual[step.name];
      }
    } finally {
      // Whatever happened, what already worked is remembered: the next run
      // starts here, not at the beginning.
      await writeRemote(opts.home, record);
    }
  }
  return record;
}

/**
 * Which Firebase project this canvas is going into.
 *
 * The reuse rule and the resume rule turn out to be one rule. A host who has
 * already provisioned a project should not dance again — that is the whole
 * "and never again" promise — and a host whose dance died halfway should pick
 * up in the project it died in. Both are "use the remote this home already
 * has", and both fall out of asking the home what it has.
 *
 * Explicit beats implicit: `--firebase-project` names one outright, whether it
 * exists here yet or not (adopting a project provisioned on another machine,
 * or one this home lost the record of). Several remotes and no flag is the one
 * case that has to ask — the home cannot know which of your places this canvas
 * belongs in.
 */
async function resolveRemote(opts: ProvisionOptions): Promise<RemoteRecord> {
  const fresh = (firebaseProject: string): RemoteRecord => ({
    kind: "firestore",
    firebaseProject,
    location: opts.location ?? DEFAULT_LOCATION,
    done: {},
  });
  if (opts.firebaseProject) {
    return (await readRemote(opts.home, opts.firebaseProject)) ?? fresh(opts.firebaseProject);
  }
  const existing = await listRemotes(opts.home);
  if (existing.length === 1) return existing[0]!;
  if (existing.length > 1) {
    throw new ProvisionError(
      "this machine hosts more than one isocan project — say which this canvas belongs in:\n" +
        existing.map((r) => `  isocan share --firebase-project ${r.firebaseProject}`).join("\n"),
    );
  }
  return fresh(firebaseProjectId(projectSuffix()));
}

/* ── the plumbing the steps stand on ────────────────────────────────────── */

/** Record something the host must do by hand, say it, and leave the step
 * undone so the next `isocan share` tries again. */
function note(run: Run, step: string, message: string): "pending" {
  run.record.manual = { ...run.record.manual, [step]: message };
  run.say(`    ↳ ${message}`);
  return "pending";
}

async function gcloud(
  run: Run,
  args: string[],
  opts: { tolerate?: RegExp } = {},
): Promise<string> {
  const done = await run.cloud.exec("gcloud", args);
  if (done.status === 0) return done.stdout.trim();
  const message = (done.stderr || done.stdout).trim();
  if (opts.tolerate?.test(message)) return "";
  throw new ProvisionError(`\`gcloud ${args.slice(0, 3).join(" ")}\` failed:\n${indent(message)}`);
}

/**
 * The two ways IAM says "ask me again". A freshly created service account is
 * eventually consistent, so the first answer is sometimes "no such thing"
 * about a thing that exists — and binding several roles in a row is several
 * read-modify-writes of one policy, which collide with each other and with
 * whatever Google is doing to a project it has just finished making. Both are
 * transient, and both want backoff rather than a louder try.
 */
const TRANSIENT =
  /does not exist|not found|NOT_FOUND|propagat|concurrent policy changes|ETag|conflict|ABORTED/i;

async function withRetry<T>(run: Run, attempt: () => Promise<T>): Promise<T> {
  for (let tries = 1; ; tries++) {
    try {
      return await attempt();
    } catch (err) {
      if (tries >= 6 || !TRANSIENT.test((err as Error).message)) throw err;
      await run.cloud.sleep(1000 * 2 ** (tries - 1));
    }
  }
}

async function token(run: Run): Promise<string> {
  run.token ??= await gcloud(run, ["auth", "print-access-token"]);
  return run.token;
}

async function api(
  run: Run,
  method: string,
  url: string,
  body?: unknown,
  opts: { tolerate?: number[] } = {},
): Promise<any> {
  const res = await run.cloud.request(
    method,
    url,
    await token(run),
    body,
    run.record.firebaseProject,
  );
  if (res.status >= 200 && res.status < 300) return res.body;
  if (opts.tolerate?.includes(res.status)) return null;
  const detail =
    typeof res.body === "string" ? res.body : (res.body?.error?.message ?? JSON.stringify(res.body));
  throw new ProvisionError(`${method} ${shortUrl(url)} → ${res.status}\n${indent(String(detail))}`);
}

/** Google's long-running operations: poll until done, then unwrap. */
async function settle(run: Run, operation: any): Promise<any> {
  let current = operation;
  for (let tries = 0; tries < 60 && current?.name && !current.done; tries++) {
    await run.cloud.sleep(2000);
    current = await api(run, "GET", `${FIREBASE_API}/v1beta1/${current.name}`);
  }
  if (current?.error) {
    throw new ProvisionError(`operation failed: ${current.error.message ?? "unknown"}`);
  }
  if (current?.name && !current.done) throw new ProvisionError("operation timed out");
  return current?.response ?? current;
}

/**
 * The generated deploy workspace: a `firebase.json`, copies of the canned
 * rules, and the page Hosting serves — under the home rather than the repo,
 * because what it points at is per-machine, and a file like that has no
 * business being committed.
 */
async function writeDeployWorkspace(run: Run): Promise<string> {
  const dir = paths.remoteDeployDir(run.home, run.record.firebaseProject);
  await fs.mkdir(path.join(dir, "config"), { recursive: true, mode: 0o700 });
  for (const file of ["firestore.rules", "storage.rules", "firestore.indexes.json"]) {
    await fs.copyFile(path.join(cannedRulesDir(), file), path.join(dir, file));
  }
  const config: Record<string, unknown> = {
    firestore: { rules: "firestore.rules", indexes: "firestore.indexes.json" },
  };
  if (run.record.storageBucket) {
    config.storage = { bucket: run.record.storageBucket, rules: "storage.rules" };
  }
  // Copied in rather than pointed at: firebase-tools refuses any `public`
  // outside its project directory. Replaced wholesale each deploy, so
  // yesterday's files do not ride along with today's.
  const publicDir = path.join(dir, "public");
  await fs.rm(publicDir, { recursive: true, force: true });
  await fs.cp(path.join(cannedRulesDir(), "placeholder"), publicDir, { recursive: true });
  config.hosting = {
    public: "public",
    ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
    // Every path lands on the one page, the guest link's
    // `/c/<projectId>#<secret>` included — there is nothing else to serve yet.
    rewrites: [{ source: "**", destination: "/index.html" }],
  };
  await fs.writeFile(path.join(dir, "firebase.json"), `${JSON.stringify(config, null, 2)}\n`);
  return dir;
}

/** Where this copy of isocan keeps the rules it deploys. */
function cannedRulesDir(): string {
  return fileURLToPath(new URL("../firebase", import.meta.url));
}

/**
 * firebase-tools, authenticated as the host's own service account rather than
 * as a person: the credential the daemon will use for the mirror is the same
 * one that deploys, so there is exactly one thing to keep and one thing to
 * revoke — and no second browser tab.
 *
 * Which takes one more step than setting `GOOGLE_APPLICATION_CREDENTIALS`.
 * firebase-tools prefers its OWN cached login to that variable, and will sit
 * there refusing to refresh a user token from a year ago rather than notice
 * the service account under its nose. So it gets a config directory of its
 * own, inside the deploy workspace, where there is no cached login to prefer.
 * That also means these deploys neither depend on nor disturb whatever
 * `firebase login` the person at this machine keeps for their own work.
 */
async function firebaseDeploy(run: Run, args: string[]): Promise<void> {
  const dir = paths.remoteDeployDir(run.home, run.record.firebaseProject);
  const done = await run.cloud.exec(
    "npx",
    [
      "--yes",
      FIREBASE_TOOLS,
      "deploy",
      ...args,
      "--project",
      run.record.firebaseProject,
      "--non-interactive",
    ],
    {
      cwd: dir,
      env: {
        XDG_CONFIG_HOME: path.join(dir, "config"),
        ...(run.record.keyFile ? { GOOGLE_APPLICATION_CREDENTIALS: run.record.keyFile } : {}),
      },
    },
  );
  if (done.status !== 0) {
    throw new ProvisionError(
      `\`firebase deploy ${args.join(" ")}\` failed:\n${indent(done.stderr || done.stdout)}`,
    );
  }
}

/** Project display names are capped at 30 characters, like the id. */
function displayName(title: string): string {
  const name = title.trim().slice(0, 30);
  return name || "isocan canvas";
}

async function fileExists(target: string): Promise<boolean> {
  return fs.stat(target).then(
    () => true,
    () => false,
  );
}

function shortUrl(url: string): string {
  return url.replace(/^https:\/\//, "").split("?")[0]!;
}

function indent(text: string): string {
  return text
    .trim()
    .split("\n")
    .slice(-8)
    .map((line) => `    ${line}`)
    .join("\n");
}
