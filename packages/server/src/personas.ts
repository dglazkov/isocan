import { promises as fs } from "node:fs";
import path from "node:path";
import { PERSONA_DIR, parsePersona, type Persona } from "@isocan/core";

/**
 * **Personas on disk, with a jail of their own.**
 *
 * They live in `.agents/personas/`, and the tree's jail refuses every name
 * beginning with a dot — correctly, because that rule is what keeps `.env`,
 * `.ssh` and `.git` out of a listing anybody can ask for. Relaxing it to let
 * personas through would open all three, which is not a trade worth making for
 * a feature about markdown files.
 *
 * So this route does not reuse that jail; it has a much tighter one, and tight
 * is the point. **The directory is fixed and the name is a stem, never a
 * path** — no separators, no dots, no traversal to check for, because there is
 * nothing here that could express it. A jail that cannot be walked out of is
 * better than one that catches every way of trying.
 */
export const PERSONA_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** The one place a persona file may be, for a given bound root. */
function personaPath(root: string, name: string): string | null {
  if (!PERSONA_NAME.test(name)) return null;
  return path.join(root, PERSONA_DIR, `${name}.md`);
}

interface PersonaOnDisk {
  /** Repo-relative, for display and for `isocan persona show`. */
  file: string;
  persona: Persona;
  /** The file verbatim, so an editor can show what is actually there rather
   *  than a re-rendering of what we parsed out of it. */
  text: string;
}

export async function readPersonas(root: string): Promise<PersonaOnDisk[]> {
  const dir = path.join(root, PERSONA_DIR);
  const names = await fs.readdir(dir).catch(() => [] as string[]);
  const out: PersonaOnDisk[] = [];
  for (const name of names.filter((n) => n.endsWith(".md")).sort()) {
    // `lstat`, so a symlink dropped into the directory is not followed out of
    // it. The doorway points the other way — `.claude/agents` → here — and
    // nothing legitimate links INTO this directory.
    const full = path.join(dir, name);
    const stat = await fs.lstat(full).catch(() => null);
    if (!stat?.isFile()) continue;
    const text = await fs.readFile(full, "utf8").catch(() => null);
    if (text === null) continue;
    const persona = parsePersona(text, name);
    // A README beside the personas is a README, not a broken persona.
    if (persona) out.push({ file: `${PERSONA_DIR}/${name}`, persona, text });
  }
  return out;
}

type PersonaWriteRefusal = "bad-name" | "not-a-persona" | "too-big" | "symlink" | "failed";

/** Front matter or it is not a persona — the same test the reader applies, so
 *  a save cannot produce a file the listing would then ignore. */
export const MAX_PERSONA_BYTES = 256 * 1024;

export async function writePersona(
  root: string,
  name: string,
  text: string,
): Promise<{ ok: true; file: string } | { ok: false; refusal: PersonaWriteRefusal }> {
  const full = personaPath(root, name);
  if (!full) return { ok: false, refusal: "bad-name" };
  if (Buffer.byteLength(text, "utf8") > MAX_PERSONA_BYTES) return { ok: false, refusal: "too-big" };
  // **Refused before it is written, not after.** A file with no front matter
  // parses to null and would vanish from the listing on the next read — saved
  // successfully and then gone, which is the worst shape a save can have.
  if (!parsePersona(text, `${name}.md`)) return { ok: false, refusal: "not-a-persona" };
  const existing = await fs.lstat(full).catch(() => null);
  if (existing?.isSymbolicLink()) return { ok: false, refusal: "symlink" };
  if (existing && !existing.isFile()) return { ok: false, refusal: "failed" };
  try {
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, text, "utf8");
  } catch {
    return { ok: false, refusal: "failed" };
  }
  return { ok: true, file: `${PERSONA_DIR}/${name}.md` };
}

/** One sentence per refusal, because "no" without which "no" leaves somebody
 *  guessing at their own filesystem. */
export function personaRefusal(refusal: PersonaWriteRefusal): string {
  switch (refusal) {
    case "bad-name":
      return "a persona is named in lowercase letters, digits and dashes — no paths, no dots";
    case "not-a-persona":
      return "a persona needs front matter: a `---` block with at least a description";
    case "too-big":
      return "that is larger than a persona should ever be";
    case "symlink":
      return "there is a symlink at that name, and this route will not write through one";
    case "failed":
      return "that could not be written";
  }
}
