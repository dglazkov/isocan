/**
 * Where a skill comes from.
 *
 * A slash command's body is a skill, which is why any published one can become
 * a command here. What stands between "one pipe away" and "one word away" is
 * this: turning what a person actually has — a repo path they read in a
 * README, or a URL they copied out of the address bar — into the file itself.
 *
 * It refuses anything it cannot name a source for. Installing a skill is
 * putting instructions in front of every future agent on this canvas, so
 * "where did this come from" has to have an answer, and that answer has to be
 * shown to somebody before it lands.
 */

export interface SkillSource {
  /** The raw file to fetch. */
  url: string;
  /** How to describe the origin to a person, e.g. "mattpocock/skills". */
  label: string;
}

/**
 * Accepts:
 *   owner/repo/path/to/SKILL.md          — the default branch
 *   https://github.com/o/r/blob/ref/p.md — what the address bar gives you
 *   https://…/anything.md                — any https URL
 */
export function skillSource(ref: string): SkillSource | null {
  const trimmed = ref.trim();
  if (trimmed === "") return null;

  if (/^https?:\/\//i.test(trimmed)) {
    // Plain http would put the instructions an agent follows on the wire in
    // the clear, for anyone to rewrite.
    if (!/^https:\/\//i.test(trimmed)) return null;
    const blob = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i.exec(trimmed);
    if (blob) {
      const [, owner, repo, gitRef, path] = blob;
      return {
        url: `https://raw.githubusercontent.com/${owner}/${repo}/${gitRef}/${path}`,
        label: `${owner}/${repo}`,
      };
    }
    try {
      const url = new URL(trimmed);
      return { url: trimmed, label: url.host };
    } catch {
      return null;
    }
  }

  // owner/repo/path… — the form a README gives you. Every segment is checked
  // rather than just counted: "file:///etc/passwd" splits into three parts
  // too, and would otherwise be fetched as a repo belonging to "file:".
  const parts = trimmed.split("/").filter((part) => part !== "");
  if (parts.length < 3) return null;
  if (!parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part) && part !== "." && part !== "..")) {
    return null;
  }
  const [owner, repo, ...rest] = parts as [string, string, ...string[]];
  return {
    url: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${rest.join("/")}`,
    label: `${owner}/${repo}`,
  };
}

/** A name for the command, when the person did not give one: the skill's own
 * directory (`…/grilling/SKILL.md` → `grilling`), else the filename. */
export function skillNameFrom(ref: string): string | null {
  const path = ref.replace(/^https?:\/\/[^/]+\//i, "").split("?")[0] ?? "";
  const parts = path.split("/").filter((part) => part !== "");
  const file = parts[parts.length - 1] ?? "";
  const base = /^skill\.md$/i.test(file) ? (parts[parts.length - 2] ?? "") : file.replace(/\.[a-z]+$/i, "");
  const name = base.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return name === "" ? null : name;
}
