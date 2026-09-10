// Generates every HTML card for the "Josh Drives Me (Crazy?)" canvas.
import { writeFileSync, mkdirSync } from "node:fs";
mkdirSync("out", { recursive: true });

// ---------- schedule arithmetic ----------
const START = new Date(2026, 8, 14); // Mon Sep 14 2026
const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekStart = (w) => new Date(START.getTime() + (w - 1) * 7 * 864e5);
const weekEnd = (w) => new Date(weekStart(w).getTime() + 6 * 864e5);
const range = (w1, w2) => `${fmt(weekStart(w1))} – ${fmt(weekEnd(w2))}`;

// ---------- shared style ----------
const css = `
  *{box-sizing:border-box} html,body{margin:0;height:100%}
  body{background:#0a0a0e;color:#f2efe6;font-family:"Avenir Next","Segoe UI",system-ui,sans-serif;overflow:hidden}
  .card{position:relative;height:100%;display:flex;flex-direction:column;padding:34px 38px 30px;
        background:radial-gradient(120% 80% at 50% 0%,#1a1218 0%,#0a0a0e 60%)}
  .scanner{position:absolute;left:0;right:0;top:0;height:8px;background:#1c1c22;overflow:hidden}
  .scanner i{position:absolute;top:0;bottom:0;width:22%;background:linear-gradient(90deg,transparent,#ff2a2a 40%,#ff6b6b 50%,#ff2a2a 60%,transparent);
             animation:scan 2.2s ease-in-out infinite alternate;box-shadow:0 0 18px #ff2a2a}
  @keyframes scan{from{left:-22%}to{left:100%}}
  .kicker{font:700 15px/1 ui-monospace,Menlo,monospace;letter-spacing:.22em;color:#ff5a5a;text-transform:uppercase}
  h1{font-size:44px;line-height:1.02;margin:10px 0 6px;font-weight:800;letter-spacing:-.01em}
  h1 small{display:block;font-size:20px;font-weight:600;color:#ffcf5a;margin-top:6px}
  .sub{color:#b9b3a6;font-size:17px;margin:0 0 18px}
  .sec{font:700 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;color:#ffcf5a;text-transform:uppercase;margin:18px 0 8px;border-bottom:1px solid #2a2a33;padding-bottom:6px}
  ul{margin:0;padding-left:0;list-style:none}
  li{padding:6px 0 6px 0;font-size:17px;line-height:1.3;border-bottom:1px dashed #23232b;display:flex;gap:10px}
  li:last-child{border-bottom:0}
  .n{flex:0 0 34px;font:700 14px/1.5 ui-monospace,Menlo,monospace;color:#8d8778}
  .night{color:#9fd3ff}
  .night .n{color:#7fbfff}
  .boss{margin-top:auto;background:linear-gradient(135deg,#3a0d12,#1c0a0d);border:1px solid #ff3b3b;border-radius:14px;padding:14px 16px;font-size:17px;line-height:1.35}
  .boss b{color:#ff6b6b;font:800 13px/1 ui-monospace,Menlo,monospace;letter-spacing:.2em;display:block;margin-bottom:6px}
  .pill{display:inline-block;background:#1f1f27;border:1px solid #33333d;border-radius:999px;padding:5px 12px;font-size:14px;margin:0 6px 6px 0;color:#e8e2d3}
  .pill.n{color:#9fd3ff;border-color:#2b4f6b}
  .tip{background:#151519;border-left:4px solid #ffcf5a;padding:10px 14px;border-radius:0 10px 10px 0;font-size:16px;line-height:1.35;color:#e6e0d1;margin-top:14px}
  .tip b{color:#ffcf5a}
  .foot{margin-top:12px;font:12px/1.4 ui-monospace,Menlo,monospace;color:#6f6a5f;letter-spacing:.06em}
  a{color:#9fd3ff}
`;
const page = (title, body, extra = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}${extra}</style></head><body>${body}</body></html>`;
const scanner = `<div class="scanner"><i></i></div>`;

// ---------- the eight levels ----------
const L = [
  {
    n: 1, emoji: "🏠", name: "Home Turf, Upgraded", w: [1, 2], tag: "precision",
    where: "Your neighborhood + one empty parking lot",
    why: "Josh is comfortable here. Comfort is the raw material; this level turns it into precision the examiner can see.",
    sessions: [
      "Baseline lap. Seat, mirrors, 9-and-3 hands. Kitt narrates the drive (commentary driving), then Josh takes over the narration.",
      "Stops & signals: full stop behind the line every time, signal 100 ft early, turn into the correct lane, head check on every turn.",
      "Backing: straight back 100 ft looking through the rear window, then backing around a corner. Camera is a helper, not the view.",
      "Three-point turn ×10 on a quiet street. Signal, mirror, shoulder, turn, back, go.",
      "Empty lot: perpendicular parking forward, then reverse-in. Learn reference points on Josh's car (mirror-to-line, etc.).",
      "Hill parking (up/down, curb/no curb), U-turns, and speed control at 15 / 25 mph without looking at the speedometer.",
      "Lot drills: hard ABS stop from 25 mph, blind-spot mapping with a parked car, hand-over-hand vs push-pull.",
      "BOSS RUN: three-point turn + reverse into the driveway + 5 full stops, zero corrections from Kitt.",
    ],
    night: [],
    boss: "3-point turn, reverse into the driveway, five complete stops, and 10 minutes of Josh's own commentary. Not one word from Kitt.",
    watch: ["Rolling stops", "Looking at the hood, not 12 s ahead", "Camera-only backing", "Hands at 10-and-2 or one-handed"],
    tip: "Commentary driving is the engine of this whole plan: Josh says out loud what he sees and what he'll do. Model it first for 5 minutes, then hand it over.",
  },
  {
    n: 2, emoji: "🚦", name: "Lights & Lanes", w: [3, 4], tag: "traffic lights",
    where: "35–45 mph arterial roads, quiet hours first",
    why: "First traffic lights and first real lane changes. Nearly every test route is made of exactly this.",
    sessions: [
      "First lights at a quiet hour: stale green vs fresh green, the yellow decision point, where to stop, right-on-red = full stop + yield.",
      "Left turns at lights: protected arrow vs unprotected. Creep into the intersection, wheels STRAIGHT while waiting, pick gaps.",
      "Lane changes ×20 on a wide, empty arterial using SMOG: Signal · Mirror · Over-the-shoulder · Go.",
      "Following distance 3–4 s, scanning 12–15 s ahead, covering the brake near driveways and crosswalks.",
      "School zones, crosswalks, cyclists, bus stops, speed-limit changes. Say every sign out loud.",
      "Double-lane turns into the correct lane, center turn lanes, first one-way street.",
      "Moderate traffic (after-school hour): put it all together for 22 minutes.",
      "BOSS RUN: 10 lane changes with full SMOG + 5 unprotected lefts + 5 lights, narrated.",
    ],
    night: [],
    boss: "10 lane changes (every one with a shoulder check), 5 unprotected lefts, 5 lights, ending in the correct lane every time.",
    watch: ["Signal after braking, not before", "Drifting wide on lefts", "Speeding up for yellows", "Skipped shoulder checks"],
    tip: "Say the decision early and calmly: “in 200 feet we'll turn right” beats “TURN HERE”. An instruction shouted late is a critical error you caused.",
  },
  {
    n: 3, emoji: "🅿️", name: "Parallel Universe", w: [5, 6], tag: "parking + roundabouts",
    where: "Cones on a quiet street, real cars, busy lots, roundabouts. First night drives.",
    why: "Parallel parking is where Colorado test-takers burn their one allowed pull-up. Roundabouts are everywhere on the Front Range.",
    sessions: [
      "Parallel park with cones, reference-point method, ×8. Slow is smooth. (Kitt: set the cones 25 ft apart to start, then 22.)",
      "Parallel ×10 between real cars on a quiet street, both left and right sides. Finish within 18 in of the curb.",
      "Busy lot: pedestrians, backing out with a 360° look, angled spaces, a drive-through.",
      "Single-lane roundabouts: slow to 15, yield to traffic in the circle, signal the exit. ×10 laps.",
      "Multi-lane roundabouts (pick the lane before you enter) + a tight parking garage.",
      "NIGHT 1: neighborhood + arterials after dark. Headlights on, dash dim, glare, speed feels slower at night.",
      "NIGHT 2: night parking lot + 3 parallel parks under streetlights.",
      "BOSS RUN: 3 of 3 parallel parks with no pull-up, then reverse-in ×3.",
    ],
    night: [6, 7],
    boss: "Three consecutive parallel parks, no pull-up, no curb touch, within 18 inches. Then three reverse-ins between real cars.",
    watch: ["Curb strike (a critical error on the test)", "Stopping inside a roundabout", "Not signaling the roundabout exit", "Forgetting headlights at dusk"],
    tip: "Reference points beat “feel”: when the back of the front car lines up with your mirror, full lock. Write Josh's points on a sticky note in the car.",
  },
  {
    n: 4, emoji: "🏙️", name: "Rush Hour", w: [7, 8, 9], tag: "city + dense traffic",
    where: "Downtown, one-way streets, real rush hour, unfamiliar routes",
    why: "Density is the skill: more decisions per minute, more things that move. Four night sessions land here.",
    sessions: [
      "Downtown at a quiet hour: one-way streets, per-lane signals, pedestrians who don't look.",
      "Unfamiliar route with navigation — voice only, no glancing at the screen. Missed a turn? Take the next one.",
      "Dense arterial traffic: gap selection, zipper merges, never blocking the box.",
      "Cyclists, bus lanes, light rail if you have it, and a construction zone.",
      "NIGHT: the city after dark — lit intersections, glare, cyclists without lights.",
      "Real rush hour (5 pm). 10-minute brief, 20-minute drive, big debrief.",
      "Left turns in heavy traffic; yellow-light calls with a car on your bumper.",
      "NIGHT: wet roads if you get them, otherwise night arterials with lane changes.",
      "Distraction inoculation: passenger chatting, music on, a sibling in back. Phones locked in the glovebox — parent's too.",
      "NIGHT: unfamiliar neighborhood at night with voice navigation.",
      "Josh picks the route and the goal. Kitt speaks only for safety.",
      "NIGHT · BOSS RUN: 30-minute urban loop at dusk.",
    ],
    night: [5, 8, 10, 12],
    boss: "A 30-minute urban loop at dusk with zero critical errors and no more than 5 minor marks on the mock score sheet.",
    watch: ["Following too close in stop-and-go", "Blocking crosswalks at reds", "Looking at the nav screen", "Late lane choice for turns"],
    tip: "The debrief order matters: Josh first (“what went well, one thing to fix”), then parent, one thing only. A list of six is a list of zero.",
  },
  {
    n: 5, emoji: "🛣️", name: "Merge Master", w: [10, 11, 12], tag: "highway",
    where: "Highway: first on a Sunday at 7 am, then busier, then at night",
    why: "A merge asks for speed control, blind-spot checks, lane changes and gap choice all at once. Every one of those is now stable. Time.",
    sessions: [
      "Prep at 45 mph on a divided road: speed matching, mirror rhythm every 5–8 s, holding a lane at speed.",
      "FIRST MERGE: Sunday 7 am, one easy on-ramp, one exit. Accelerate to traffic speed IN the ramp. Repeat ×3.",
      "20 minutes on the highway: lane discipline, 4-second gap, exactly the limit.",
      "Lane changes at speed ×10: pass on the left, return right, mirror-signal-shoulder every time.",
      "Exits: slow in the ramp, not on the highway. Read ramp speed signs; curves tighten.",
      "NIGHT: highway after dark — high/low beams, trucks, judging closing speed by headlights.",
      "Moderate weekday traffic (mid-morning).",
      "Interchanges: left exits, weave lanes, express lanes, ‘keep right except to pass’.",
      "NIGHT: night highway with two exits and a re-entry.",
      "Heavy traffic: stop-and-go at 15 mph, 2-second cushion, eyes in the mirror for the car behind.",
      "NIGHT: an unfamiliar highway route with voice navigation.",
      "NIGHT · BOSS RUN: the 25-minute highway loop.",
    ],
    night: [6, 9, 11, 12],
    boss: "25-minute highway loop in moderate traffic: 4 merges, 6 lane changes, 2 exits, cushion never under 3 seconds.",
    watch: ["Merging below traffic speed", "Stopping at the end of the ramp", "Braking on the highway for an exit", "Camping in the left lane"],
    tip: "Choose the ramp for the lesson: long acceleration lane, good sightlines, light traffic, dry daylight, and an exit soon after. Never the first merge at rush hour.",
  },
  {
    n: 6, emoji: "🏔️", name: "Weather & Wild", w: [13, 14, 15], tag: "Colorado edition",
    where: "Snowy lots, canyon roads, dusk wildlife hours, sun glare. Timed for December on purpose.",
    why: "Colorado will hand Josh snow, ice, grades, deer and blinding sun in his first year. Better with Kitt in the seat than alone.",
    sessions: [
      "Empty snowy (or wet) lot: ABS stops, feeling the skid start, gentle inputs, steering into the slide.",
      "Snow roads: double the following distance, no cruise control, brake early and straight.",
      "Ice awareness: bridges and shade first, black ice, why you scrape the WHOLE windshield.",
      "Mountain road: downhill in a low gear, brake fade, curves, pull-outs for faster traffic.",
      "NIGHT: wildlife hour at dusk — scanning the ditches, high-beam etiquette, don't swerve for small animals.",
      "Sun glare at sunrise/sunset: visor, sunglasses, following the lane line, slowing down.",
      "Gravel / dirt road: loose surface, washboard, dust from oncoming cars.",
      "NIGHT: snow at night if you have it, otherwise the coldest, darkest arterial run you can find.",
      "Traction & chain laws (read the signs), then a foothills highway with grades and trucks.",
      "NIGHT: a mountain road after dark.",
      "Breakdown drill: pull over fully, hazards, what's in the trunk kit, and the after-a-crash checklist.",
      "NIGHT · BOSS RUN: Kitt's hard drive.",
    ],
    night: [5, 8, 10, 12],
    boss: "Kitt picks the route: canyon + wet or snowy pavement + dusk, 30 minutes, fully narrated by Josh.",
    watch: ["Cruise control in snow", "Riding the brakes downhill", "Swerving for wildlife", "Peephole-scraped windshield"],
    tip: "If the weather doesn't cooperate in these three weeks, swap sessions with Level 7 and come back. The calendar serves the skill, not the other way round.",
  },
  {
    n: 7, emoji: "📋", name: "Test Prep", w: [16, 17, 18], tag: "mock tests",
    where: "Mock tests near the driving school you'll test at",
    why: "Josh can drive. Now he learns to show it the way an examiner scores it: exaggerated head checks, complete stops, exact speeds.",
    sessions: [
      "Pre-drive check rehearsal: headlights, signals, brake lights, horn, wipers, defrost, hand signals. Paperwork in the glovebox.",
      "MOCK TEST 1: parent as examiner, printed score sheet, silent except for instructions.",
      "Fix list from mock 1: big obvious head checks, full stops, speed exactly at the limit, signal at 100 ft.",
      "Scout the third-party school's test area and drive the likely route twice.",
      "NIGHT: mock test at night.",
      "MOCK TEST 2.",
      "Maneuvers only: parallel ×5, three-point ×5, backing 50 ft ×5, hill parking ×2.",
      "NIGHT: night route with maneuvers.",
      "MOCK TEST 3 with a different adult as examiner (fresh eyes, less patience).",
      "NIGHT: repeat the weakest two items from mock 3.",
      "Role reversal: parent drives, Josh is the examiner and scores every error out loud.",
      "NIGHT · BOSS RUN: MOCK TEST 4.",
    ],
    night: [5, 8, 10, 12],
    boss: "Mock test 4: 90+ on the sheet, zero critical errors, and Josh calls his own two weakest moments before Kitt does.",
    watch: ["Head checks the examiner can't see", "Rolling ‘California’ stops", "5 over the limit", "Wheels turned while waiting to turn left"],
    tip: "Silence is the hardest coaching skill. In a mock test, say only what an examiner would say. Every hint you give is a point Josh didn't earn.",
  },
  {
    n: 8, emoji: "🏁", name: "License & Beyond", w: [19, 20], tag: "the test",
    where: "Top-up hours, the booking, the family contract, the test",
    why: "Two weeks of polish, paperwork and the first-year rules. Then Josh drives to get ice cream alone.",
    sessions: [
      "Book the drive test at an approved third-party school. Verify the log: 50 hrs / 10 night, permit held 12 months, 6 hrs behind-the-wheel done.",
      "Top-up whatever the log is short on: highway or night.",
      "NIGHT: top-up.",
      "Solo simulation: Kitt silent, Josh runs an errand start to finish including parking.",
      "The family driving contract: first-year passenger rules, the midnight–5 am curfew, no phone at all, who pays gas and insurance.",
      "NIGHT: final night polish.",
      "Day before: light drive, car clean, no warning lights, brake lights work, plates, insurance card, registration.",
      "BOSS RUN: THE DRIVE TEST. Then the first solo drive. 🍦",
    ],
    night: [3, 6],
    boss: "The real thing. Pass = ≤15 deductions and no critical errors. Then Josh drives somewhere alone and texts a photo when parked.",
    watch: ["An unlogged hour", "Test car with a warning light or a dead brake light", "A short night on the night before", "Skipping the contract talk"],
    tip: "Colorado's first-year rules aren't optional: no passengers under 21 for 6 months, no more than one for a year, no driving 12–5 am, no phone. Put them in writing and sign both names.",
  },
];

const nightCount = L.reduce((a, l) => a + l.night.length, 0);
const total = L.reduce((a, l) => a + l.sessions.length, 0);
console.log(`sessions ${total}, night ${nightCount}`);

for (const l of L) {
  const items = l.sessions.map((s, i) => {
    const isN = l.night.includes(i + 1);
    return `<li class="${isN ? "night" : ""}"><span class="n">S${i + 1}${isN ? " 🌙" : ""}</span><span>${s}</span></li>`;
  }).join("");
  const wk = l.w.length === 1 ? `Week ${l.w[0]}` : `Weeks ${l.w[0]}–${l.w[l.w.length - 1]}`;
  const body = `${scanner}<div class="card">
    <div class="kicker">Level ${l.n} of 8 · ${l.tag}</div>
    <h1>${l.emoji} ${l.name}<small>${wk} · ${range(l.w[0], l.w[l.w.length - 1])} · ${l.sessions.length} sessions${l.night.length ? ` · ${l.night.length} at night` : ""}</small></h1>
    <p class="sub"><b>Where:</b> ${l.where}<br><b>Why now:</b> ${l.why}</p>
    <div class="sec">The sessions (30 min each)</div>
    <ul>${items}</ul>
    <div class="sec">Kitt watches for</div>
    <div>${l.watch.map((w) => `<span class="pill">⚠️ ${w}</span>`).join("")}</div>
    <div class="tip"><b>Coach's tip.</b> ${l.tip}</div>
    <div class="boss"><b>🎮 Boss battle — pass to unlock Level ${l.n + 1 > 8 ? "∞" : l.n + 1}</b>${l.boss}</div>
  </div>`;
  writeFileSync(`out/level-${l.n}.html`, page(`Level ${l.n} — ${l.name}`, body));
}

// ---------- the route poster ----------
{
  const pts = [
    [110, 660], [290, 600], [500, 700], [720, 560], [960, 420], [1170, 470], [1360, 330], [1530, 450], [1700, 300],
  ];
  // label spec per level: [dx, y, anchor]
  const lab = [
    [0, 662, "middle"], [46, 712, "start"], [0, 502, "middle"], [0, 352, "middle"],
    [0, 532, "middle"], [0, 272, "middle"], [0, 512, "middle"], [40, 242, "end"],
  ];
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  const nodes = L.map((l, i) => {
    const [x, y] = pts[i + 1];
    const [dx, ty, anchor] = lab[i];
    return `
      <g>
        <circle cx="${x}" cy="${y}" r="30" fill="#0a0a0e" stroke="#ff3b3b" stroke-width="4"/>
        <circle cx="${x}" cy="${y}" r="22" fill="#1c1c22"/>
        <text x="${x}" y="${y + 8}" text-anchor="middle" font-size="24" font-weight="800" fill="#ffcf5a" font-family="ui-monospace,Menlo,monospace">${l.n}</text>
        <text x="${x + dx}" y="${ty}" text-anchor="${anchor}" font-size="22" font-weight="800" fill="#f2efe6">${l.emoji} ${l.name}</text>
        <text x="${x + dx}" y="${ty + 24}" text-anchor="${anchor}" font-size="15" fill="#b9b3a6" font-family="ui-monospace,Menlo,monospace">wk ${l.w[0]}${l.w.length > 1 ? "–" + l.w[l.w.length - 1] : ""} · ${l.sessions.length} sessions${l.night.length ? " · " + l.night.length + "🌙" : ""}</text>
      </g>`;
  }).join("");
  const extra = `
    body{background:#07070a}
    .poster{position:relative;width:1800px;height:900px;overflow:hidden;background:radial-gradient(90% 70% at 50% 100%,#161019 0%,#07070a 70%)}
    .ttl{position:absolute;left:40px;top:34px}
    .ttl .kicker{font-size:16px}
    .ttl h1{font-size:64px;margin:6px 0 0;letter-spacing:-.02em}
    .ttl h1 span{color:#ff4b4b}
    .ttl p{margin:8px 0 0;color:#b9b3a6;font-size:20px;max-width:760px}
    .gauge{position:absolute;right:40px;bottom:30px;background:#101014;border:1px solid #2a2a33;border-radius:16px;padding:16px 20px;width:430px}
    .gauge .kicker{font-size:12px;margin-bottom:10px}
    .bar{height:18px;background:#1c1c22;border-radius:9px;overflow:hidden;margin:6px 0 12px}
    .bar i{display:block;height:100%;background:linear-gradient(90deg,#ff3b3b,#ffcf5a)}
    .bar.n i{background:linear-gradient(90deg,#3d7bd6,#9fd3ff)}
    .gauge .row{display:flex;justify-content:space-between;font-size:16px}
    .gauge .row b{font-family:ui-monospace,Menlo,monospace}
    .math{position:absolute;left:40px;bottom:30px;display:flex;gap:12px;flex-wrap:wrap;max-width:1300px}
    .chip{background:#101014;border:1px solid #2a2a33;border-radius:999px;padding:10px 18px;font-size:17px}
    .chip b{color:#ffcf5a;font-family:ui-monospace,Menlo,monospace}
    .kitt{position:absolute;left:40px;top:250px;background:#101014;border:1px solid #2a2a33;border-radius:16px;padding:14px 18px;max-width:420px;font-size:17px;line-height:1.35;color:#e6e0d1}
    .kitt b{color:#ff6b6b}
  `;
  const body = `${scanner}<div class="poster">
    <svg viewBox="0 0 1800 900" width="1800" height="900" style="position:absolute;inset:0">
      <polygon points="0,760 220,530 380,620 560,440 720,580 900,300 1080,530 1260,250 1440,480 1620,180 1800,400 1800,900 0,900" fill="#151520"/>
      <polygon points="0,820 300,620 520,720 760,580 1000,720 1300,540 1600,660 1800,580 1800,900 0,900" fill="#0e0e14"/>
      <path d="${d}" fill="none" stroke="#2b2b34" stroke-width="58" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#ffcf5a" stroke-width="4" stroke-dasharray="26 22" opacity=".9"/>
      <text x="${pts[0][0]}" y="${pts[0][1] + 14}" text-anchor="middle" font-size="44">🚗</text>
      <text x="${pts[0][0]}" y="${pts[0][1] + 70}" text-anchor="middle" font-size="15" fill="#b9b3a6" font-family="ui-monospace,Menlo,monospace">10 hrs · sleepy streets</text>
      <text x="1755" y="400" text-anchor="middle" font-size="46">🏁</text>
      <text x="1755" y="432" text-anchor="middle" font-size="18" font-weight="800" fill="#ffcf5a">LICENSE</text>
      ${nodes}
    </svg>
    <div class="ttl">
      <div class="kicker">Mission briefing · Colorado · ${fmt(START)} → ${fmt(weekEnd(20))}, 2027</div>
      <h1>Josh Drives Me <span>(Crazy?)</span></h1>
      <p>Eight levels from sleepy streets to a Colorado driver's license. Four sessions a week, thirty minutes each, one skill at a time. Kitt rides shotgun.</p>
    </div>
    <div class="kitt"><b>KITT:</b> “Ten hours in, Josh. Forty to go, and the state wants ten of them in the dark. I've plotted the route. Every level ends in a boss battle. Michael never had a plan this good.”</div>
    <div class="gauge">
      <div class="kicker">Odometer · Colorado log</div>
      <div class="row"><span>Supervised hours</span><b>10 / 50</b></div>
      <div class="bar"><i style="width:20%"></i></div>
      <div class="row"><span>Night hours</span><b>0 / 10</b></div>
      <div class="bar n"><i style="width:0%"></i></div>
      <div class="row"><span>Permit held</span><b>?? / 12 months</b></div>
      <div class="bar"><i style="width:0%;background:#8d8778"></i></div>
    </div>
    <div class="math">
      <span class="chip"><b>40 hrs</b> still to log</span>
      <span class="chip"><b>4 × 30 min</b> = 2 hrs / week</span>
      <span class="chip"><b>20 weeks</b> · <b>80 sessions</b></span>
      <span class="chip"><b>20 sessions</b> 🌙 = the 10 night hrs</span>
      <span class="chip"><b>8</b> boss battles</span>
    </div>
  </div>`;
  writeFileSync("out/route.html", page("The Route", body, extra));
}

// ---------- Colorado rulebook ----------
{
  const body = `${scanner}<div class="card">
    <div class="kicker">The rules of the game</div>
    <h1>🏔️ Colorado Rulebook<small>What the state needs before Josh can test — and after he passes</small></h1>
    <div class="sec">Before the test</div>
    <ul>
      <li><span class="n">📜</span><span><b>Permit held 12 months.</b> A 16-year-old's instruction permit must be held a full year before the drive test. Check the issue date — it sets the earliest possible test day.</span></li>
      <li><span class="n">⏱️</span><span><b>50 hours logged, 10 at night.</b> Supervised by a parent or guardian, on a signed log. Josh has 10; this plan logs the other 40 and all 10 night hours.</span></li>
      <li><span class="n">🚘</span><span><b>6 hours behind the wheel with a driving school</b> if the permit was issued before 16½. (12 parent hours substitute if you live 30+ miles from a school.) Verify it's done or book it into Level 7.</span></li>
      <li><span class="n">🏫</span><span><b>The drive test is at an approved third-party driving school.</b> Book weeks ahead — winter slots fill. Bring the permit, the signed log, and proof of insurance and registration for the test car.</span></li>
    </ul>
    <div class="sec">How the test is scored</div>
    <ul>
      <li><span class="n">💀</span><span><b>Critical error = instant fail:</b> any collision or curb/cone contact, the examiner touching the wheel or brake, a dangerous or illegal move, or a moving violation (speeding, running a sign or light).</span></li>
      <li><span class="n">🧮</span><span><b>Pass = no criticals and no more than 15 deductions</b> across turns, intersections, lane changes, merging, lane position, signaling, speed, and the slow-speed maneuvers.</span></li>
      <li><span class="n">↩️</span><span><b>One free pull-up</b> on a parking or slow-speed maneuver. The second one costs points.</span></li>
      <li><span class="n">🔁</span><span><b>Signal 100 ft ahead in town, 200 ft on a four-lane highway.</b> Examiners count.</span></li>
    </ul>
    <div class="sec">After he passes — the first year</div>
    <div>
      <span class="pill">🚫 No passengers under 21 for 6 months (family excepted)</span>
      <span class="pill">👥 No more than one under-21 passenger until 12 months</span>
      <span class="pill">🌙 No driving midnight–5 am for a year (school, work, emergencies excepted)</span>
      <span class="pill">📵 No phone use at all under 18 — not even hands-free</span>
      <span class="pill">🔒 Everyone belted, every trip</span>
    </div>
    <div class="tip"><b>Kitt's note.</b> Rules move. Before booking, confirm the current requirements at dmv.colorado.gov (Minor License) and with the school you'll test at.</div>
    <div class="foot">Sources: Colorado DMV · Colorado General Assembly (minor drivers) · CDOT teen drivers · Colorado driving schools' test guides</div>
  </div>`;
  writeFileSync("out/rulebook.html", page("Colorado Rulebook", body));
}

// ---------- the 30-minute recipe ----------
{
  const extra = `.clock{display:grid;grid-template-columns:70px 1fr;gap:8px 14px;margin:6px 0 0}
    .clock b{font:800 22px/1.2 ui-monospace,Menlo,monospace;color:#ffcf5a}
    .clock span{font-size:17px;line-height:1.35;padding-bottom:10px;border-bottom:1px dashed #23232b}`;
  const body = `${scanner}<div class="card">
    <div class="kicker">Every session, same shape</div>
    <h1>⏱️ The 30-Minute Recipe<small>Short and frequent beats long and rare. Four of these a week is the whole method.</small></h1>
    <div class="clock">
      <b>0–3</b><span><b>Brief.</b> One skill, said in one sentence. The win condition (“three parallel parks, no pull-up”). Where we're going. Phones in the glovebox — both of you.</span>
      <b>3–25</b><span><b>Drive.</b> Josh narrates (commentary driving): what he sees, what he'll do, why. Kitt gives early, calm, specific cues — “in 200 feet, right turn, right lane” — and otherwise shuts up.</span>
      <b>25–30</b><span><b>Debrief, parked.</b> Josh first: one thing that went well, one thing to fix. Then parent: ONE thing. Log the minutes on the spot. Done.</span>
    </div>
    <div class="sec">Kitt's coaching rules</div>
    <ul>
      <li><span class="n">1</span><span><b>One skill per session.</b> Everything else is background. If it's a lane-change day, ignore the slightly wide turn.</span></li>
      <li><span class="n">2</span><span><b>Early beats loud.</b> Instructions go out 10 seconds before they're needed. A shouted “STOP” means the plan already failed.</span></li>
      <li><span class="n">3</span><span><b>Hands off unless it's danger.</b> Grabbing the wheel is what the examiner does before failing him. Don't train him to expect it.</span></li>
      <li><span class="n">4</span><span><b>Ask, don't tell.</b> “What's the speed limit here?” “Who has the right of way?” Retrieval builds judgment; answers don't.</span></li>
      <li><span class="n">5</span><span><b>Model it first.</b> New skill? Parent drives 5 minutes narrating it, then swaps. Teens learn from demonstration far better than from description.</span></li>
      <li><span class="n">6</span><span><b>Don't skip the boring ones.</b> Neighborhood loops don't count as progress after Level 1. New roads, new times, new weather — variety is the curriculum.</span></li>
      <li><span class="n">7</span><span><b>End on a win.</b> If the last five minutes were rough, do one thing Josh is good at before parking. He should get out wanting the next session.</span></li>
      <li><span class="n">8</span><span><b>Log it immediately.</b> The Colorado log needs date, minutes, night/day, and a signature. A paper log in the glovebox or the app — but that day, not Sunday.</span></li>
    </ul>
    <div class="tip"><b>Missed a session?</b> Don't double up to 60 minutes. Attention fades fast past 30. Just slide the week; the route has slack in Level 8.</div>
  </div>`;
  writeFileSync("out/recipe.html", page("The 30-Minute Recipe", body, extra));
}

// ---------- the drive test boss card ----------
{
  const body = `${scanner}<div class="card">
    <div class="kicker">Final boss</div>
    <h1>🎮 The Drive Test<small>Print this. Use it as the score sheet for every mock test in Level 7.</small></h1>
    <div class="sec">Pre-drive check (the test starts in the parking lot)</div>
    <div>
      <span class="pill">Headlights</span><span class="pill">Turn signals</span><span class="pill">Brake lights</span><span class="pill">Horn</span>
      <span class="pill">Wipers & washer</span><span class="pill">Defrost</span><span class="pill">Hand signals ✋</span><span class="pill">Emergency brake</span>
      <span class="pill">Seat belt on before the examiner sits</span>
    </div>
    <div class="sec">Instant fails — one and it's over</div>
    <ul>
      <li><span class="n">💥</span><span>Hitting a curb, cone, or anything else</span></li>
      <li><span class="n">🤚</span><span>Examiner grabs the wheel, brakes, or has to speak to prevent danger</span></li>
      <li><span class="n">🚨</span><span>Running a stop sign or red light; any moving violation; speeding</span></li>
      <li><span class="n">🌀</span><span>A dangerous or illegal maneuver (wrong lane, unsafe turn, ignoring a pedestrian)</span></li>
    </ul>
    <div class="sec">Point-takers — 15 or fewer to pass</div>
    <ul>
      <li><span class="n">↔️</span><span>Lane changes without mirror + shoulder check; drifting; poor lane position</span></li>
      <li><span class="n">↩️</span><span>Turns: too wide, too tight, wrong lane at the end, no signal at 100 ft</span></li>
      <li><span class="n">🛑</span><span>Incomplete stops, stopping over the line, stopping too far back</span></li>
      <li><span class="n">🐢</span><span>Too slow (impeding traffic) counts too, not only too fast</span></li>
      <li><span class="n">🅿️</span><span>Slow-speed maneuvers: parallel park, three-point turn, backing. One free pull-up.</span></li>
      <li><span class="n">👀</span><span>Not scanning: head fixed, no mirror checks, no look at intersections</span></li>
    </ul>
    <div class="sec">Mock test routine (Level 7)</div>
    <ul>
      <li><span class="n">1</span><span>Parent is “examiner”: gives directions only, no coaching, no reactions.</span></li>
      <li><span class="n">2</span><span>Route ~20 min: residential, arterial with lights, 4+ lane changes, an unprotected left, a roundabout if nearby, then maneuvers.</span></li>
      <li><span class="n">3</span><span>Tally on this sheet. Score 100 minus deductions. Josh guesses his score before he sees it.</span></li>
      <li><span class="n">4</span><span>Book the real test only after two mocks at 90+ with zero criticals.</span></li>
    </ul>
    <div class="boss"><b>🏁 Pass condition</b>No critical errors and ≤15 deductions. Then Josh signs the family contract and drives for ice cream. Alone. 🍦</div>
  </div>`;
  writeFileSync("out/boss.html", page("The Drive Test", body));
}

// ---------- skill tree (mermaid) ----------
writeFileSync("out/skill-tree.mmd", `flowchart LR
  classDef have fill:#1f3d2a,stroke:#5bd18a,color:#e8ffe8
  classDef next fill:#3a2a10,stroke:#ffcf5a,color:#fff3d0
  classDef later fill:#1c1c22,stroke:#8d8778,color:#f2efe6
  classDef boss fill:#3a0d12,stroke:#ff3b3b,color:#ffe0e0

  A[Quiet streets ✅]:::have --> B[Precision stops & signals]:::next
  A --> C[Backing & 3-point turn]:::next
  A --> D[Speed control by feel]:::next
  B --> E[Traffic lights & unprotected lefts]:::later
  D --> F[Lane changes · SMOG]:::later
  C --> G[Parallel & reverse parking]:::later
  E --> H[Roundabouts]:::later
  E --> I[City & rush hour]:::later
  F --> I
  D --> J[Gap choice & following distance]:::later
  F --> K{{Highway merge}}:::boss
  J --> K
  D --> K
  I --> L[Night driving 🌙]:::later
  K --> M[Highway at night 🌙]:::later
  L --> N[Snow · ice · mountains 🏔️]:::later
  M --> N
  G --> O{{Mock tests}}:::boss
  H --> O
  I --> O
  N --> O
  O --> P{{THE DRIVE TEST 🏁}}:::boss
`);

{
  const rows = [];
  let week = 0;
  for (const l of L) {
    l.sessions.forEach((txt, i) => {
      if (i % 4 === 0) week++;
      const col = (i % 4) + 1;
      let short = txt.split(/[:.—]/)[0].replace(/\s+/g, " ").trim();
      if (short.length > 46) short = short.slice(0, 44).trim() + "…";
      const isN = l.night.includes(i + 1);
      rows.push([week, col, `${isN ? "🌙 " : ""}L${l.n}·S${i + 1} ${short}`].join("\t"));
    });
  }
  writeFileSync("out/sessions.tsv", rows.join("\n") + "\n");
  const names = [];
  for (let w = 1; w <= 20; w++) {
    const lv = L.find((l) => l.w.includes(w));
    names.push(`W${w} · ${fmt(weekStart(w))} · L${lv.n}`);
  }
  writeFileSync("out/rows.txt", names.join(","));
}
console.log("done");
