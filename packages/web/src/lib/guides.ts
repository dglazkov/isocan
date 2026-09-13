/**
 * The canvases that explain isocan, kept where the app and the docs can both
 * point at them.
 *
 * Each lives at isocan.io with its link grant open, so a stranger who follows
 * one arrives on the canvas rather than at a refusal — checked by hand from a
 * browser that was nobody, 10 Sep 2026. If one is ever closed or moved, this
 * list is the one place to fix, and `guides.test.ts` holds the shape of every
 * address so a typo cannot ship as a dead link.
 *
 * `README.md`, `docs/start.md` and friends carry the same addresses in prose;
 * the test reads them back out of the README so the two cannot drift apart.
 */
type GuideCanvas = {
  /** The canvas's own title, as its home lists it — the `[isocan]` prefix is how these stand out in a long list. */
  title: string;
  /** Where it is — a full address, so the link works from any origin. */
  url: string;
  /** One line on what a reader finds there. */
  about: string;
};

/** Public destinations shared by Help and the README; the catalog test keeps their addresses in sync. */
export const GUIDE_CANVASES: readonly GuideCanvas[] = [
  {
    title: "[isocan] Getting Started",
    url: "https://isocan.io/p/prj_6nodKBn0oA",
    about: "Five steps to a first working session, and the concepts underneath — a deck, one screen each.",
  },
  {
    title: "[isocan] Demo",
    url: "https://isocan.io/p/prj_sN8FgZuimi",
    about: "The story of isocan, told on the canvas it is about.",
  },
  {
    title: "[isocan] System design",
    url: "https://isocan.io/p/prj_6fgykNN1_m",
    about: "Thirteen drivable instruments: the operation waist, the door, two ledgers, home and replica.",
  },
  {
    title: "[isocan] History",
    url: "https://isocan.io/p/prj_Gi8oGKNALt",
    about: "How it was built, day by day, from the first commit.",
  },
  {
    title: "[isocan] Roadmap",
    url: "https://isocan.io/p/prj_OE-AuGl119",
    about: "Every research note and project by where it stands, mirrored from the tree.",
  },
];
