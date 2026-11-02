#!/usr/bin/env bash
# Run inside the publish job's concurrency group, before either ref moves.
# A release commit can fast-forward while its generated tree goes BACKWARDS:
# its first parent is the old release, its last parent is the source it built.
# Compare source ancestry, not job completion order or generated commit order.
set -euo pipefail

fail() { echo "release-order: $*" >&2; exit 1; }
note() { echo "release-order: $*" >&2; }
ancestor() {
  local status=0
  git merge-base --is-ancestor "$1" "$2" || status=$?
  # 1 means unrelated; an unreadable object is an error, not supersession.
  if (( status > 1 )); then exit "$status"; fi
  return "$status"
}

head=$(git rev-parse --verify --end-of-options "${1:?expected tested commit}^{commit}")
[[ $(git rev-parse HEAD) == "$head" ]] || fail "checkout differs from the tested commit $head"

# A missing optional ref is normal on the first release. A failed fetch is not.
# Discover once, fetch the refs that exist, and discard absent tracking refs so
# a rerun cannot make a decision from the checkout's stale snapshot.
remote_refs=$(git ls-remote --heads origin refs/heads/main refs/heads/green refs/heads/release)
specs=()
for name in main green release; do
  if printf '%s\n' "$remote_refs" | grep -q "[[:space:]]refs/heads/${name}$"; then
    specs+=("+refs/heads/$name:refs/remotes/origin/$name")
  else
    [[ "$name" != main ]] || fail "origin/main is missing"
    git update-ref -d "refs/remotes/origin/$name"
  fi
done
git fetch --no-tags origin "${specs[@]}"
ancestor "$head" refs/remotes/origin/main || fail "$head is not on origin/main"

promote=true
publish=true
if git show-ref --verify --quiet refs/remotes/origin/green; then
  green=$(git rev-parse refs/remotes/origin/green)
  if [[ "$head" == "$green" ]]; then
    promote=false
    note "green already names $head; CLI publication may still need a retry"
  elif ancestor "$head" "$green"; then
    promote=false
    publish=false
    note "$head is superseded by tested commit $green"
  elif ! ancestor "$green" "$head"; then
    fail "green $green and tested commit $head have diverged"
  fi
fi

if git show-ref --verify --quiet refs/remotes/origin/release; then
  # release.mjs makes [source] for the first release, [previous, source] after.
  # Full parent SHAs avoid relying on the manifest's abbreviated build stamp.
  read -r -a lineage <<< "$(git rev-list --parents -n 1 refs/remotes/origin/release)"
  (( ${#lineage[@]} == 2 || ${#lineage[@]} == 3 )) || fail "release has an unexpected parent layout"
  source_commit=${lineage[${#lineage[@]}-1]}
  if [[ "$head" == "$source_commit" ]] || ancestor "$head" "$source_commit"; then
    publish=false
    note "$head is already covered by released source $source_commit"
  elif ! ancestor "$source_commit" "$head"; then
    fail "released source $source_commit and tested commit $head have diverged"
  fi
fi

# Nothing is emitted until every read/check succeeds. The workflow appends
# these outputs to GITHUB_OUTPUT; an error cannot accidentally authorize work.
printf 'promote=%s\npublish=%s\n' "$promote" "$publish"
