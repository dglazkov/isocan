#!/usr/bin/env bash
#
# Start a project on a canvas: empty directory → git repo → GitHub → a canvas
# bound to the directory → a main thread → agents parked on `isocan wait`.
#
# Or start from a repo that already exists, with --from: that hands the first
# step to `isocan clone`, which clones and readies the directory and reports
# the canvas the repo's committed marker names. Everything after it is the
# same walk — every step here is idempotent, so a clone that arrived already
# bound is met with "already bound" rather than a second canvas.
#
# `isocan clone` on its own is the whole answer when all you want is the repo
# on this machine and on its canvas. This script is that plus the parts a
# PROJECT wants: a person, a main thread, and agents parked on it.
#
# The walk this automates is `docs/new-project.md`, and that doc is the
# explanation. This is the version you run when you already know why.
#
#   ./scripts/new-project.sh acme-widgets
#   ./scripts/new-project.sh acme-widgets --agents claude,codex --launch
#   ./scripts/new-project.sh --from dglazkov/isocan --agents claude,codex
#   ./scripts/new-project.sh --here --no-github
#
set -euo pipefail

INSTALL_SPEC="github:dglazkov/isocan#release"
AGENT_BRIEF='Use the isocan-collab skill. Name yourself, appear on the canvas, then park on isocan wait.'
GENERIC_BRIEF='Read .agents/skills/isocan-collab/SKILL.md, then run isocan --agent-help and follow it.'

name=""
dir=""
from=""
here=0
github=1
visibility="--private"
agents="claude"
launch=0
person=""
title=""

die() { echo "new-project: $*" >&2; exit 1; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
note() { printf '    %s\n' "$*"; }

usage() {
  cat <<'USAGE'
usage: new-project.sh [name] [options]

  name              directory to create, and the canvas's title (omit with --here)

  --here            use the current directory instead of creating one
  --from <repo>     clone an existing repo instead of starting empty — any
                    URL git takes, or owner/name. Uses `isocan clone`, so a
                    repo carrying a .isocan marker lands on THAT canvas
  --dir <path>      create the project at <path> instead of ./<name>
  --title <text>    canvas title (default: the directory name)
  --as <name>       who you are, if this machine has no identity yet
  --agents <list>   comma-separated harnesses to brief (default: claude)
                    known: claude, codex, gemini, pi, antigravity; anything
                    else is launched with its own ISOCAN_SESSION_ID
  --launch          open a terminal tab per agent (macOS) instead of printing
  --no-github       skip `gh repo create`
  --public          create the GitHub repo public (default: private)
  -h, --help        this
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    --here) here=1 ;;
    --from) from="${2:-}"; shift ;;
    --dir) dir="${2:-}"; shift ;;
    --title) title="${2:-}"; shift ;;
    --as) person="${2:-}"; shift ;;
    --agents) agents="${2:-}"; shift ;;
    --launch) launch=1 ;;
    --no-github) github=0 ;;
    --public) visibility="--public" ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $1 (--help)" ;;
    *) [ -z "$name" ] || die "one name, please: already have \"$name\""; name="$1" ;;
  esac
  shift
done

# ---------- where ----------

if [ "$here" = 1 ]; then
  [ -z "$name" ] || die "--here takes no name — it means this directory"
  [ -z "$from" ] || die "--from clones into a new directory; --here is this one"
  root="$PWD"
else
  # `--from` names the directory the way `git clone` does — the last path
  # segment, minus `.git` — so `--from dglazkov/isocan` needs no second word.
  if [ -z "$name" ] && [ -n "$from" ]; then
    name="$(basename "${from%.git}")"
  fi
  [ -n "$name" ] || { usage >&2; exit 1; }
  root="${dir:-$PWD/$name}"
fi
root="$(cd "$(dirname "$root")" 2>/dev/null && printf '%s/%s' "$PWD" "$(basename "$root")")" \
  || die "no such parent directory for: ${dir:-$PWD/$name}"
[ -n "$title" ] || title="$(basename "$root")"

# ---------- preflight ----------

step "Checking the tools"
command -v git >/dev/null || die "git is not on PATH"
note "git $(git --version | awk '{print $3}')"

if command -v isocan >/dev/null; then
  note "isocan $(isocan --version)"
else
  note "isocan is not on PATH — \`isocan setup\` will install it"
  note "  (npm i -g $INSTALL_SPEC)"
fi

if [ "$github" = 1 ]; then
  if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
    note "gh, authenticated"
  else
    github=0
    note "gh missing or not logged in — skipping GitHub (\`gh auth login\` and \`gh repo create\` later)"
  fi
fi

# ---------- 1. the directory and the repo ----------

step "The directory and the repo"
if [ -n "$from" ] && [ ! -d "$root" ]; then
  # Hand the whole first step to `isocan clone`: it clones, readies the
  # directory exactly as step 2 would, and says which canvas the repo's
  # committed marker names. Nothing from the repo is installed or run — see
  # `isocan clone --help` for why that is deliberate.
  if command -v isocan >/dev/null; then
    isocan clone "$from" "$root"
  else
    npx -y "$INSTALL_SPEC" clone "$from" "$root"
    command -v isocan >/dev/null || die "clone did not put isocan on PATH — open a new shell and re-run"
  fi
  # A cloned repo has an origin already; creating one would be a second remote
  # for somebody else's project.
  github=0
elif [ -d "$root" ]; then
  [ "$here" = 1 ] || note "$root already exists — using it"
  [ -z "$from" ] || note "not cloning: $root is already here"
  [ -z "$from" ] || github=0
else
  mkdir -p "$root"
  note "created $root"
fi
cd "$root"

if [ -d .git ]; then
  note "already a git repo"
else
  git init -q
  note "git init"
fi

if [ ! -e README.md ]; then
  printf '# %s\n' "$title" > README.md
  note "wrote README.md"
fi

if [ -z "$(git log --oneline -1 2>/dev/null || true)" ]; then
  git add -A
  git -c commit.gpgsign=false commit -qm "Start $title"
  note "first commit"
fi

if [ "$github" = 1 ]; then
  if git remote get-url origin >/dev/null 2>&1; then
    note "origin already set: $(git remote get-url origin)"
  else
    gh repo create "$(basename "$root")" $visibility --source=. --remote=origin --push
    note "pushed to $(git remote get-url origin)"
  fi
fi

# ---------- 2. ready the directory ----------

step "Readying the directory for canvas work"
# --no-open: the browser opens once at the end, on the canvas, not on a
# daemon that has nothing bound to it yet.
if command -v isocan >/dev/null; then
  isocan setup --no-open
else
  npx -y "$INSTALL_SPEC" setup --no-open
  command -v isocan >/dev/null || die "setup did not put isocan on PATH — open a new shell and re-run"
fi

# ---------- 3. who you are ----------

step "Who this canvas belongs to"
# Setup deliberately creates no canvas, because creating one stamps it with
# whoever typed the command. This script IS a person at a terminal, so the
# canvas wants the machine's person on it — not a session identity.
if isocan whoami --json >/dev/null 2>&1; then
  note "$(isocan whoami --json | sed -n 's/.*"name" *: *"\([^"]*\)".*/\1/p') — this machine's person"
else
  if [ -z "$person" ]; then
    [ -t 0 ] || die "this machine has no identity and there is no terminal to ask on — pass --as \"Your Name\""
    printf '    this machine has no identity yet. Your name: '
    read -r person
  fi
  [ -n "$person" ] || die "a name is required"
  isocan identity --name "$person" --home
fi

# ---------- 4. the canvas, and the marker that binds it ----------

step "The canvas"
if [ -f .isocan/project.json ]; then
  # The marker, not `canvas list`: a freshly cloned canvas has not been
  # materialized yet (that happens on the first write), so asking the daemon
  # what it holds answers "(none)" about a directory that is plainly bound.
  note "already bound — $(sed -n 's/.*"title" *: *"\([^"]*\)".*/\1/p' .isocan/project.json) ($(sed -n 's/.*"projectId" *: *"\([^"]*\)".*/\1/p' .isocan/project.json))"
else
  canvas="$(isocan canvas create "$title" --json | sed -n 's/.*"canvasId" *: *"\([^"]*\)".*/\1/p')"
  [ -n "$canvas" ] || die "could not read the new canvas's id out of \`canvas create --json\`"
  isocan use "$canvas"
fi

# ---------- 5. one channel to listen on ----------

step "The project channel"
if [ "$(isocan comment main --json 2>/dev/null)" = "null" ] || ! isocan comment main >/dev/null 2>&1; then
  thread="$(isocan comment add --at 0,0 "Project channel — anything posted here wakes every parked agent." --json \
    | sed -n 's/.*"threadId" *: *"\([^"]*\)".*/\1/p')"
  [ -n "$thread" ] || die "could not read the new thread's id out of \`comment add --json\`"
  isocan comment main "$thread"
else
  note "$(isocan comment main)"
fi

# ---------- 6. commit the marker ----------

step "Committing the marker"
# The marker is what makes the canvas travel with the repo: a teammate who
# clones lands on the SAME canvas rather than forking a new one. The skill is
# how their harness discovers the protocol without being told.
git add .isocan/project.json .agents/skills .claude/skills 2>/dev/null || true
if git diff --cached --quiet; then
  note "nothing new to commit"
else
  git -c commit.gpgsign=false commit -qm "Bind this directory to its canvas"
  note "committed"
  if [ "$github" = 1 ]; then
    git push -q origin HEAD && note "pushed"
  fi
fi

# ---------- 7. bring the agents in ----------

launch_line() {
  # Each agent needs a session id of its own — that is what tells two agents in
  # ONE directory apart. Harnesses isocan knows set theirs; the rest get one.
  case "$1" in
    claude|codex|pi|antigravity)
      printf "%s '%s'" "$1" "$AGENT_BRIEF" ;;
    *)
      printf 'ISOCAN_SESSION_ID="$(uuidgen)" ISOCAN_HARNESS=%s %s '"'"'%s'"'"'' "$1" "$1" "$GENERIC_BRIEF" ;;
  esac
}

step "The agents"
IFS=',' read -r -a wanted <<< "$agents"
for agent in "${wanted[@]}"; do
  agent="$(echo "$agent" | tr -d '[:space:]')"
  [ -n "$agent" ] || continue
  line="$(launch_line "$agent")"
  if [ "$launch" = 1 ] && [ "$(uname)" = "Darwin" ]; then
    if ! command -v "$agent" >/dev/null; then
      note "$agent is not on PATH — skipping its tab, run it yourself:"
      printf '      %s\n' "$line"
      continue
    fi
    osascript >/dev/null <<OSA
tell application "Terminal"
  activate
  do script "cd $(printf '%q' "$root") && $(printf '%s' "$line" | sed 's/\\/\\\\/g; s/"/\\"/g')"
end tell
OSA
    note "opened a Terminal tab for $agent"
  else
    printf '      %s\n' "$line"
  fi
done

if [ "$launch" != 1 ]; then
  note ""
  note "Run each of those in its own terminal, in $root."
  note "One waiter per agent: \`isocan wait\` is a FOREGROUND call — the blocking"
  note "call returning IS the wake-up, so an agent that backgrounds it can never"
  note "be woken."
fi

step "Done"
isocan open || true
