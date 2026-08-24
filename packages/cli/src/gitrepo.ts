/**
 * What a person means by "the repo", and what to call the directory.
 *
 * Two small rules with one property worth protecting: **git's own syntax is
 * passed through untouched.** git accepts ssh, https, `scp`-style
 * `host:path`, local paths, and file URLs, and it has decades of expectations
 * attached to each. Anything clever here would be the cheerful-wrong-address
 * failure (phase 7) arriving in a new place — a URL that nearly works, aimed
 * somewhere the person did not name.
 *
 * They live in their own module so a test can import the rules rather than
 * restate them (lessons.md #5), and so checking them costs no network.
 */

/**
 * The one convenience: `owner/name` becomes a GitHub https URL.
 *
 * Safe because it is unambiguous. git itself would read `dglazkov/isocan` as a
 * relative directory, and a directory of that shape sitting in your cwd is not
 * a thing that happens — whereas saying a GitHub repo that way is how everyone
 * says it out loud.
 *
 * A leading `.` or `/`, a scheme, or an `scp`-style colon means git syntax,
 * and it is handed over as typed.
 */
export function gitRemote(raw: string): string {
  const trimmed = raw.trim();
  if (/^[a-zA-Z0-9][\w.-]*\/[\w.-]+$/.test(trimmed) && !trimmed.startsWith(".")) {
    return `https://github.com/${trimmed}.git`;
  }
  return trimmed;
}

/**
 * The directory `git clone` would pick, computed ahead of it so the command
 * can refuse a collision BEFORE cloning rather than after.
 *
 * Mirrors git's rule: the last path segment with `.git` removed. Trailing
 * slashes are stripped first, because `…/isocan/` is a thing people paste and
 * git handles it.
 */
export function defaultCloneDir(remote: string): string {
  const tail = remote.replace(/[/\\]+$/, "").split(/[/\\:]/).pop() ?? "";
  const name = tail.replace(/\.git$/i, "");
  if (!name) throw new Error(`cannot tell what to call the directory for: ${remote}`);
  return name;
}
