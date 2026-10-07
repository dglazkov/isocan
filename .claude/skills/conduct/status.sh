#!/usr/bin/env bash
# conduct/status.sh <project>: where a project stands, mechanically.
# Reads docs/projects/<project>/{phases,journey}.md and docs/projects/README.md.
# Prints the where-we-are paragraph, every phase's status, the next phase and
# what it needs, the Open roster, and lints the docs' own rules. Changes nothing.
set -u
ROOT=${ISOCAN_REPO_ROOT:-$(cd "$(dirname "$0")/../../.." && pwd)}
P=${1:?usage: status.sh <project>}
D=$ROOT/docs/projects/$P
PH=$D/phases.md; J=$D/journey.md; IDX=$ROOT/docs/projects/README.md
[ -f "$PH" ] || { echo "no such project: $P ($PH)"; exit 2; }

section() { # section <heading-line>: print from that exact heading to the next ## heading
  # Exact string compare, not a regex: a title carrying (S) or any other
  # metacharacter cannot be matched as one, because awk strips the backslash
  # out of a -v assignment before the regex ever sees it.
  awk -v want="$1" '$0 == want {on=1; print; next} on && /^## / {exit} on {print}' "$PH"
}
esc() { printf '%s' "$1" | sed 's/[][\.*^$(){}+?|]/\\&/g'; }  # still used by the where-we-are lint

echo "== $P: where we are"
awk 'tolower($0) ~ /^\*\*where we are/ {on=1} on && /^$/ {exit} on {print}' "$PH"
echo
echo "== phases"
awk '
  /^[ \t]*(```|~~~)/ { fence=!fence; next }
  fence { next }
  /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/ { if (title != "" && !seen) printf "  %-12s %s\n", "(no status)", title; title=$0; sub(/^## /,"",title); seen=0; next }
  /^## / { if (title != "" && !seen) printf "  %-12s %s\n", "(no status)", title; title=""; seen=0; next }
  /^\*\*Status:[ \t]*/ && title != "" && !seen {
    s=$0; sub(/^\*\*Status:[ \t]*/,"",s);
    if (match(s, /^[A-Z][A-Z-]*( [A-Z][A-Z-]+)*/)) s=substr(s, RSTART, RLENGTH);
    else { sub(/[.*(].*$/,"",s); sub(/ — .*$/,"",s); sub(/ +$/,"",s); }
    printf "  %-12s %s\n", s, title; seen=1
  }
  END { if (title != "" && !seen) printf "  %-12s %s\n", "(no status)", title }
' "$PH"
NPH=$(awk '/^[ \t]*(```|~~~)/{f=!f;next} !f && /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/{c++} END{print c+0}' "$PH")
NST=$(awk '/^[ \t]*(```|~~~)/{f=!f;next} !f && /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/{inP=1;seen=0;next} !f && /^## /{inP=0;next} !f && inP && !seen && /^\*\*Status:[ \t]*/{c++;seen=1} END{print c+0}' "$PH")
NEXT=$(awk '/^[ \t]*(```|~~~)/{f=!f;next} !f && /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/{t=$0;seen=0;next} !f && /^## /{t="";next} !f && t!="" && !seen && /^\*\*Status:[ \t]*NOT STARTED/{print t; exit} !f && t!="" && /^\*\*Status:[ \t]*/{seen=1}' "$PH")
PART=$(awk '/^[ \t]*(```|~~~)/{f=!f;next} !f && /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/{t=$0;seen=0;next} !f && /^## /{t="";next} !f && t!="" && !seen && /^\*\*Status:[ \t]*PART-DONE/{sub(/^## /,"",t); printf "%s; ", t; seen=1} !f && t!="" && /^\*\*Status:[ \t]*/{seen=1}' "$PH")
echo
echo "== next: ${NEXT#\#\# }"
if [ -z "$NEXT" ]; then
  if [ "$NST" = 0 ]; then echo "   unknown: no phase carries a Status line yet; add them (vocabulary in SKILL.md) in the orient commit"
  else echo "   none: every phase is started"; fi
fi
[ -n "$PART" ] && echo "   part-done, walks still owed: $PART"
grep -n -i -E 'waits on|waiting on' "$PH" | sed -n '1,6p' | sed 's/^/   /'
if [ -n "$NEXT" ]; then
  echo
  echo "== the next phase's proof"
  proof=$(section "$NEXT" | awk '/^\*\*(Proof|Acceptance|Done when)/ {on=1} on && /^$/ {exit} on {print "   " $0}'); echo "${proof:-   (no Proof paragraph: fix the doc before briefing)}"
  echo "== its provision steps (⚑): asked out loud first, with the price"
  prov=$(section "$NEXT" | grep '⚑' | sed 's/^/   /'); echo "${prov:-   none}"
fi
echo
echo "== front matter and index"
printf '   journey.md: '; if [ -f "$J" ]; then grep -E '^status:' "$J" || echo "(no status: line)"; else echo "(no journey.md)"; fi
printf '   note:       '; [ -f "$J" ] && grep -E '^note:' "$J" | cut -c1-160 || echo
printf '   index row:  '; [ -f "$IDX" ] && grep -E "^\| \[$P\]" "$IDX" | awk -F'|' '{print $4}' | sed -E 's/^ *//; s/ *$//' | cut -c1-160 || echo
echo
echo "== open roster (debts nothing else records)"
open=$(grep -n -E '^- \*\*20[0-9]{2}-[0-9]{2}-[0-9]{2}(\*\*)? — Open' "$PH" | sed 's/^/   /'); echo "${open:-   none}"
echo
echo "== lint"
n=0
# every phase must carry a Status line using only NOT STARTED, PART-DONE, CLOSED, RETIRED
if [ "$NPH" -gt 0 ] && [ "$NST" != "$NPH" ]; then echo "   $NPH phases, $NST Status lines: every phase must carry a **Status: line"; n=$((n+1)); fi
st_lint=$(awk '
  function check_phase() {
    if (title != "" && !seen) printf "   %s has no **Status: line\n", title
  }
  /^[ \t]*(```|~~~)/ { fence=!fence; next }
  fence { next }
  /^## (Phase [0-9]|[0-9]+(\.[0-9]+)?\. )/ { check_phase(); title=$0; sub(/^## /,"",title); seen=0; next }
  /^## / { check_phase(); title=""; seen=0; next }
  /^\*\*Status:[ \t]*/ && title != "" && !seen {
    s=$0; sub(/^\*\*Status:[ \t]*/,"",s);
    if (match(s, /^[A-Z][A-Z-]*( [A-Z][A-Z-]+)*/)) w=substr(s, RSTART, RLENGTH);
    else { w=s; sub(/[.*(].*$/,"",w); sub(/ — .*$/,"",w); sub(/ +$/,"",w); }
    if (w != "NOT STARTED" && w != "PART-DONE" && w != "CLOSED" && w != "RETIRED") {
      printf "   %s has invalid status \"%s\" (expected NOT STARTED, PART-DONE, CLOSED, or RETIRED)\n", title, w
    }
    seen=1
  }
  END { check_phase() }
' "$PH")
[ -n "$st_lint" ] && { echo "$st_lint"; n=$((n+1)); }
# trajectory entries longer than sixty words, and sections over three hundred
fl=$(awk '
  function flush() { if (f) { w=split(buf, a, /[ \t]+/); if (w > 60) printf "   entry of %d words at line %d: %s\n", w, ln, substr(buf,1,70) "…"; f=0; buf="" } }
  /^## Phase / { flush(); if (sec && secw > 300) printf "   %s of %s run %d words (rule: under three hundred)\n", hd, sec, secw; sec=$0; sub(/^## /,"",sec); secw=0; inF=0 }
  /^\*\*(Findings|Trajectory)[:.]\*\*/ { inF=1; hd=$0; sub(/^\*\*/,"",hd); sub(/[:.].*$/,"",hd); next }
  /^\*\*Formerly:/ { inF=0 }
  inF && /^- \*\*20[0-9][0-9]-/ { flush(); f=1; ln=NR; buf=$0; secw+=NF; next }
  inF && f && /^  / { buf=buf " " $0; secw+=NF; next }
  inF && f { flush() }
  END { flush(); if (sec && secw > 300) printf "   %s of %s run %d words (rule: under three hundred)\n", hd, sec, secw }
' "$PH")
[ -n "$fl" ] && { echo "$fl"; n=$((n+1)); }
# the where-we-are line and the Status lines must agree on what is next
if [ -n "$NEXT" ]; then
  num=$(printf '%s' "$NEXT" | sed -E 's/^## (Phase )?([0-9.]+).*/\2/')
  awk 'tolower($0) ~ /^\*\*where we are/ {on=1} on && /^$/ {exit} on {print}' "$PH" | grep -q -i -E "phase $(esc "$num")([^0-9.]|$)" || { echo "   where-we-are does not name $P phase $num as next, but it is the first NOT STARTED phase"; n=$((n+1)); }
fi
[ "$n" = 0 ] && echo "   clean"
exit $(( n > 0 ))
