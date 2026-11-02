#!/usr/bin/env bash
# The measurement, as it runs INSIDE the container. `scripts/first-minute.mjs`
# pipes this to `bash -s -- <spec> <runs>`; it is a file rather than a string in
# that script because shell and JavaScript spell `${...}` the same way.
#
# One script rather than several `docker exec`s: every step's cost has to be
# paid on the same cold disk, in the order an agent pays it, and a second
# container would arrive with the first one's caches gone but its install too.
# It prints its progress on stderr and one `FIRST-MINUTE <json>` line at the
# end, so a person watching sees movement and the host parses one thing.
set -u
spec="$1"
runs="$2"
say() { echo "sandbox: $*" >&2; }

# The floor. Every isocan number below includes it, and a reader comparing
# 0.5 s against 3 s deserves to know what an empty node process costs here.
node_ms() {
  local start end
  start=$(date +%s%N)
  node -e '' >/dev/null 2>&1
  end=$(date +%s%N)
  echo $(( (end - start) / 1000000 ))
}
floor_ms=$(node_ms)

say "installing $spec"
install_start=$(date +%s%N)
npm install -g "$spec" >/tmp/install.log 2>&1
install_status=$?
install_end=$(date +%s%N)
install_ms=$(( (install_end - install_start) / 1000000 ))
if [ "$install_status" -ne 0 ]; then
  say "install failed"
  tail -40 /tmp/install.log >&2
  echo "FIRST-MINUTE {\"ok\":false,\"stage\":\"install\",\"installMs\":$install_ms}"
  exit 0
fi

# npm's own count, which is the number #332 quotes. The directory count beside
# it is a check on it, not a second opinion: npm says nothing about packages
# when nothing changed.
packages=$(sed -n 's/^added \([0-9][0-9]*\) packages.*/\1/p' /tmp/install.log | head -1)
[ -n "${packages:-}" ] || packages=0
root=/usr/local/lib/node_modules/isocan
tree_mb=$(du -sm "$root" 2>/dev/null | cut -f1)
dep_dirs=$(find "$root/node_modules" -maxdepth 3 -name package.json 2>/dev/null | wc -l | tr -d ' ')
has_docs=$([ -d "$root/docs" ] && echo true || echo false)

# Cold means no tsx cache. tsx v4 writes under the temp dir and under
# ~/.cache; both go before the cold run.
cold_caches() {
  rm -rf /tmp/tsx-* "$HOME/.cache/tsx" "$root/node_modules/.cache" 2>/dev/null || true
}

version_ms() {
  local start end
  start=$(date +%s%N)
  isocan --version >/dev/null 2>&1
  end=$(date +%s%N)
  echo $(( (end - start) / 1000000 ))
}

say "timing isocan --version"
cold_caches
cold_ms=$(version_ms)
warm=""
i=0
while [ "$i" -lt "$runs" ]; do
  warm="$warm$(version_ms) "
  i=$(( i + 1 ))
done
warm_best=$(echo "$warm" | tr ' ' '\n' | grep -v '^$' | sort -n | head -1)

# The opens. Counted twice: every openat the command makes, and the ones that
# found a file — a resolver's misses are work a sandbox charges for too.
say "counting file opens"
opens=-1
opens_found=-1
if strace -f -o /tmp/strace.out -e trace=openat isocan --version >/dev/null 2>/tmp/strace.err; then
  opens=$(grep -c 'openat(' /tmp/strace.out || true)
  opens_found=$(grep 'openat(' /tmp/strace.out | grep -vc '= -1' || true)
else
  say "strace unavailable: $(head -1 /tmp/strace.err)"
fi

printf 'FIRST-MINUTE {"ok":true,"installMs":%s,"packages":%s,"treeMb":%s,"depDirs":%s,"hasDocs":%s,"coldMs":%s,"warmMs":%s,"warmRuns":"%s","opens":%s,"opensFound":%s,"nodeFloorMs":%s}\n' \
  "$install_ms" "$packages" "${tree_mb:-0}" "${dep_dirs:-0}" "$has_docs" \
  "$cold_ms" "$warm_best" "$(echo "$warm")" "${opens:--1}" "${opens_found:--1}" "$floor_ms"
