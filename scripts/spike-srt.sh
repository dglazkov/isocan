#!/usr/bin/env bash
# Does the fence hold on THIS machine?
#
# `isocan rc --sandbox` wraps every adapter in srt
# (@anthropic-ai/sandbox-runtime), and the wrapper knows six things the
# 11 Sep 2026 spike found — each of them a silent failure otherwise. That
# spike ran on Linux. macOS takes a different path through srt (Seatbelt,
# with loopback reachable directly rather than only through a proxy), and
# until somebody runs this there, the note's recommendation stands at
# "adopt when step 1 holds on macOS too".
#
# This is step 1, and steps 2 and 3, in one command. It starts a throwaway
# daemon on a throwaway home, so it touches nothing you own: no canvas of
# yours, no enrolment of yours, no config of yours.
#
#   ./scripts/spike-srt.sh                  # steps 1 and 2 (needs a harness login)
#   ./scripts/spike-srt.sh --no-harness     # step 1 alone, no login, no spend
#   ./scripts/spike-srt.sh --harness codex  # step 3: the nesting question
#
# Findings go to docs/research/2026-09-10-what-the-rc-hands-over.md, under
# "The srt spike, measured" — one line per row of the table this prints,
# with this machine's platform and versions, which the last line gives you
# ready to paste.
set -uo pipefail

HARNESS=claude-code
RUN_HARNESS=1
for arg in "$@"; do
  case "$arg" in
    --no-harness) RUN_HARNESS=0 ;;
    --harness) shift ;;
    --harness=*) HARNESS="${arg#*=}" ;;
    claude-code | codex | pi | antigravity) HARNESS="$arg" ;;
    -h | --help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISOCAN="node $REPO/packages/cli/bin/isocan.js"
SPIKE="$(mktemp -d)"
HOME_DIR="$SPIKE/home"
PROJ="$SPIKE/proj"
PORT=$((4700 + RANDOM % 200))
CANARY="$HOME/.isocan-spike-canary"
mkdir -p "$HOME_DIR" "$PROJ"

PASS=0
FAIL=0
ROWS=()
row() { # row <name> <verdict> <detail>
  ROWS+=("$(printf '%-34s %-8s %s' "$1" "$2" "${3-}")")
  if [ "$2" = "held" ] || [ "$2" = "ok" ]; then PASS=$((PASS + 1)); else FAIL=$((FAIL + 1)); fi
}
say() { printf '\n\033[1m%s\033[0m\n' "$1"; }

cleanup() {
  [ -n "${DAEMON_PID:-}" ] && kill "$DAEMON_PID" 2>/dev/null
  rm -f "$CANARY"
  rm -rf "$SPIKE"
}
trap cleanup EXIT

say "The machine"
PLATFORM="$(uname -s)"
echo "  $(uname -srm), node $(node --version)"
for bin in srt bwrap socat rg; do
  if command -v "$bin" >/dev/null; then echo "  $bin: $(command -v "$bin")"; else echo "  $bin: absent"; fi
done
if command -v srt >/dev/null; then
  # Thing 6: the fence must be able to see its own files, so the policy has
  # to re-allow wherever srt really lives — and a .bin symlink points at a
  # RELATIVE path, which is why this resolves rather than reads it.
  SRT_PKG="$(node -e '
    const fs=require("fs"), path=require("path");
    let dir=path.dirname(fs.realpathSync(process.argv[1]));
    for (let up=0; up<5; up++) {
      if (fs.existsSync(path.join(dir,"package.json"))) { console.log(dir); break; }
      const parent=path.dirname(dir); if (parent===dir) break; dir=parent;
    }
  ' "$(command -v srt)" 2>/dev/null)"
  SRT_VERSION="$(node -e 'try{console.log(require(process.argv[1]+"/package.json").version)}catch{}' "$SRT_PKG" 2>/dev/null)"
  echo "  srt lives in: ${SRT_PKG:-unresolved}"
  echo "  srt version: ${SRT_VERSION:-unknown}"
else
  echo
  echo "srt is not on the PATH, and every step below needs it:"
  echo "  npm i -g @anthropic-ai/sandbox-runtime"
  [ "$PLATFORM" = "Linux" ] && echo "  sudo apt install bubblewrap socat ripgrep"
  [ "$PLATFORM" = "Darwin" ] && echo "  brew install ripgrep"
  exit 1
fi
# Thing 1, on Linux: srt's inner bridge listens on an IPv6 socket, and a
# kernel without IPv6 kills both listeners into /dev/null — every call from
# inside then fails with "connection refused after 0 ms" and nothing says
# why. `isocan harness` refuses to fence such a machine; this says so early.
if [ "$PLATFORM" = "Linux" ] && [ ! -e /proc/net/if_inet6 ]; then
  echo "  IPv6: ABSENT — srt's Linux bridge cannot listen, so isocan will refuse to fence here"
fi

say "A throwaway daemon and canvas"
export ISOCAN_HOME="$HOME_DIR" ISOCAN_PORT="$PORT"
# --home, not --session: the flag that names the PERSON who owns a machine.
# (`--session` names the agent running the command, and a person running a
# spike by hand is not one — it refuses, naming the variable it looked for.)
SETUP="$($ISOCAN identity --name "srt spike" --home 2>&1 | tail -1)"
(cd "$PROJ" && exec $ISOCAN serve --foreground >"$SPIKE/daemon.log" 2>&1) &
DAEMON_PID=$!
for _ in $(seq 1 40); do
  curl -sS -m 1 -o /dev/null "http://127.0.0.1:$PORT/api/health" 2>/dev/null && break
  sleep 0.25
done
echo "  daemon on http://127.0.0.1:$PORT, home $HOME_DIR"
echo "  identity: $SETUP"
echo "  canvas: $( (cd "$PROJ" && $ISOCAN canvas create "srt spike" 2>&1 | tail -1) )"
echo "the person's own file" >"$CANARY"

# What `isocan rc --sandbox` would build here, asked of the code itself
# rather than reimplemented — so a drift between this script and the
# wrapper shows up as a failure here rather than as a false pass.
say "Step 0 — what isocan says it can do"
SCAN="$(cd "$PROJ" && $ISOCAN --json harness 2>/dev/null | node -e '
let s=""; process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s); const b=j.sandbox ?? {};
  console.log(`${b.can ? "can" : "cannot"}\t${b.engine ?? "?"}\t${b.why ?? ""}`);
})')"
CAN="$(echo "$SCAN" | cut -f1)"
echo "  $(echo "$SCAN" | tr '\t' ' ')"
if [ "$CAN" != "can" ]; then
  row "isocan can fence here" "REFUSED" "$(echo "$SCAN" | cut -f3)"
else
  row "isocan can fence here" "ok" "$(echo "$SCAN" | cut -f2)"
fi

say "Step 1 — the fence, and the daemon through it"
POLICY="$SPIKE/policy.json"
cat >"$POLICY" <<EOF
{
  "network": {
    "allowedDomains": ["127.0.0.1:$PORT", "localhost:$PORT", "api.anthropic.com", "registry.npmjs.org"],
    "deniedDomains": [],
    "allowLocalBinding": false
  },
  "filesystem": {
    "denyRead": ["$HOME"],
    "allowRead": ["$PROJ", "$HOME_DIR", "$REPO", "$HOME/.npm", "$HOME/.claude", "$(dirname "$(dirname "$(command -v node)")")", "${SRT_PKG:-/nonexistent}"],
    "allowWrite": ["$PROJ", "$HOME_DIR", "/tmp", "$HOME/.npm", "$HOME/.claude"],
    "denyWrite": []
  }
}
EOF
# Things 2 and 3: srt sets NO_PROXY to include 127.0.0.1 — the one address
# that must go through its proxy — and Node's fetch ignores the proxy
# variables unless told. Both have to be set INSIDE, after srt's --setenv.
INNER='export NO_PROXY= no_proxy= NODE_USE_ENV_PROXY=1; sleep 1;'
fenced() { (cd "$PROJ" && srt --settings "$POLICY" -- sh -c "$INNER $1" 2>&1); }

# srt refuses to run on a policy it cannot parse rather than falling back to
# a default — the right failure, and one that would otherwise read as "the
# person's home is hidden" in every row below, because nothing was readable
# for the reason that nothing ran at all.
PREFLIGHT="$(fenced "echo the-fence-started")"
if ! echo "$PREFLIGHT" | grep -q "the-fence-started"; then
  echo "  srt would not start:"
  echo "$PREFLIGHT" | sed 's/^/    /' | head -8
  row "the fence starts at all" "BROKE" "$(echo "$PREFLIGHT" | tail -1 | cut -c1-60)"
  say "What this machine found"
  printf '%s\n' "${ROWS[@]}"
  echo
  echo "Nothing below could be measured. Fix the policy or the install and re-run."
  exit 1
fi
row "the fence starts at all" "ok" "srt $SRT_VERSION on $PLATFORM"

OUT="$(fenced "curl -sS -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/health")"
case "$OUT" in
  *400 | *200 | *401 | *403) row "loopback to the daemon (curl)" "held" "HTTP ${OUT##* }" ;;
  *) row "loopback to the daemon (curl)" "BROKE" "$(echo "$OUT" | tail -1)" ;;
esac

# The whole output, not its tail: the answer is a JSON object, whose last
# line is a closing brace.
OUT="$(fenced "$ISOCAN --json whoami")"
if echo "$OUT" | grep -q '"name"'; then
  row "the isocan CLI, inside" "held" "answered as $(echo "$OUT" | sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' | head -1)"
else
  row "the isocan CLI, inside" "BROKE" "$(echo "$OUT" | tail -1)"
fi

# The long poll the summons protocol rests on: a park that cannot open is a
# fence that looks fine until an agent tries to wait.
OUT="$(fenced "$ISOCAN wait --timeout 5" | tail -2)"
if echo "$OUT" | grep -qi "timed out with no feedback"; then
  row "isocan wait, inside" "held" "parked and timed out cleanly"
else
  row "isocan wait, inside" "BROKE" "$(echo "$OUT" | tail -1)"
fi

OUT="$(fenced "cat '$CANARY' && echo CANARY-READ || echo CANARY-REFUSED" | tail -2)"
if echo "$OUT" | grep -q "CANARY-READ"; then
  row "the person's home is hidden" "BROKE" "the canary was readable"
elif echo "$OUT" | grep -q "CANARY-REFUSED"; then
  row "the person's home is hidden" "held" "$(echo "$OUT" | head -1 | cut -c1-50)"
else
  row "the person's home is hidden" "BROKE" "neither — the probe did not run: $(echo "$OUT" | tail -1 | cut -c1-40)"
fi

OUT="$(fenced "curl -sS -m 10 -o /dev/null -w '%{http_code}' https://example.com/")"
if echo "$OUT" | grep -qE "403|blocked|000"; then
  row "an unlisted domain is refused" "held" "$(echo "$OUT" | tail -1 | cut -c1-40)"
else
  row "an unlisted domain is refused" "BROKE" "reached it: $OUT"
fi

# macOS only: srt can let the child dial loopback directly, without the
# proxy hop. isocan does not use it (srt issue #88 widened the boundary
# once, and the literal already works) — but if the proxy path above broke
# and this holds, that is the finding, and the wrapper should learn it.
if [ "$PLATFORM" = "Darwin" ]; then
  node -e '
    const fs=require("fs"); const p=process.argv[1];
    const c=JSON.parse(fs.readFileSync(p,"utf8")); c.network.allowLocalBinding=true;
    fs.writeFileSync(p.replace(".json","-binding.json"), JSON.stringify(c,null,2));
  ' "$POLICY"
  OUT="$( (cd "$PROJ" && srt --settings "${POLICY%.json}-binding.json" -- sh -c "sleep 1; curl -sS -m 8 --noproxy '*' -o /dev/null -w '%{http_code}' http://127.0.0.1:$PORT/api/health") 2>&1)"
  case "$OUT" in
    *400 | *200 | *401 | *403) row "macOS allowLocalBinding, direct" "ok" "HTTP ${OUT##* } (not what isocan uses)" ;;
    *) row "macOS allowLocalBinding, direct" "no" "$(echo "$OUT" | tail -1)" ;;
  esac
fi

if [ "$RUN_HARNESS" = "1" ]; then
  say "Steps 2 and 3 — a real $HARNESS turn, really fenced"
  echo "  (needs $HARNESS logged in ALREADY, outside the fence: browser login inside is denied)"
  (cd "$PROJ" && $ISOCAN rc add Spike --harness "$HARNESS" >/dev/null 2>&1)
  TURN="$(cd "$PROJ" && timeout 400 $ISOCAN rc turn --sandbox Spike \
    'Use your Bash tool for both, then reply with the two answers on two lines and nothing else. 1: run `isocan --json whoami` and give the id. 2: run `cat '"$CANARY"'` and give its output or the error.' 2>&1)"
  echo "$TURN" | grep -vE "UNDICI|trace-warnings|\[session/|Unexpected case" | tail -12
  if echo "$TURN" | grep -q "turn ended — end_turn"; then
    row "a fenced $HARNESS turn completes" "held" "end_turn"
  else
    row "a fenced $HARNESS turn completes" "BROKE" "$(echo "$TURN" | grep -i error | tail -1 | cut -c1-70)"
  fi
  if echo "$TURN" | grep -q "usr_"; then
    row "the agent reached the daemon" "held" "isocan whoami answered inside the turn"
  else
    row "the agent reached the daemon" "BROKE" "no actor id came back"
  fi
  if echo "$TURN" | grep -q "the person's own file"; then
    row "the agent could not read \$HOME" "BROKE" "it read the canary"
  else
    row "the agent could not read \$HOME" "held" "the canary was refused"
  fi
  # Thing 5: with $HOME denied and the harness's own directory not
  # re-allowed, the session store lands on the sandbox's tmpfs and the
  # agent's memory is silently reset every turn.
  SECOND="$(cd "$PROJ" && timeout 400 $ISOCAN rc turn --sandbox Spike 'Reply with one word: what did I ask you to cat?' 2>&1)"
  if echo "$SECOND" | grep -q "resumed"; then
    row "the session resumes, fenced" "held" "session/load"
  else
    row "the session resumes, fenced" "BROKE" "rebuilt — re-allow the harness's config dir"
  fi
fi

say "What this machine found"
printf '%s\n' "${ROWS[@]}"
printf '\n%d held, %d broke.\n' "$PASS" "$FAIL"

say "For the note"
printf 'Measured %s on %s (%s), node %s, srt %s%s: %d held, %d broke.\n' \
  "$(date +%Y-%m-%d)" "$PLATFORM" "$(uname -m)" "$(node --version)" "${SRT_VERSION:-unknown}" \
  "$([ "$RUN_HARNESS" = "1" ] && echo ", $HARNESS" || echo ", step 1 only")" "$PASS" "$FAIL"
echo "Add a paragraph to docs/research/2026-09-10-what-the-rc-hands-over.md under"
echo '"The srt spike, measured" — the rows above are the facts; what they MEAN is the'
echo "part worth writing, and a row that broke is worth more than one that held."
[ "$FAIL" -gt 0 ] && exit 1
exit 0
