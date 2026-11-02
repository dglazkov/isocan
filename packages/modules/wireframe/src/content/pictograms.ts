/**
 * **Pictograms** — the little greyscale line drawings a fleshed wire puts in
 * its image, thumbnail and card-cover slots (design §10): a parcel for a
 * delivery, a pan for a recipe, a drill for a tool. One 24-unit grid, one
 * stroke, round ends, no fill — drawn in `currentColor`, so the sheet decides
 * their colour from the theme's roles and none is written here.
 */
const P: Record<string, string> = {
  parcel: `<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9M7.5 5.2l9 4.6"/>`,
  box: `<path d="M3 8h18v12H3zM3 8l2-4h14l2 4M9.5 12h5"/>`,
  truck: `<path d="M5 16.5H2V6h11v10.5H9M13 9h4.5l3.5 3.5v4h-1.5M13 16.5h2"/><circle cx="7" cy="16.5" r="2"/><circle cx="17.5" cy="16.5" r="2"/>`,
  scan: `<path d="M3 7.5V4h3.5M17.5 4H21v3.5M21 16.5V20h-3.5M6.5 20H3v-3.5M7 8v8M10 8v8M13.5 8v8M17 8v8"/>`,
  pan: `<circle cx="10" cy="12" r="6.5"/><path d="M16.5 12H22M7.5 10c.8-1 2-1.4 3.2-1.1"/>`,
  bowl: `<path d="M3 11h18a9 8 0 0 1-18 0zM7.5 21h9M9 7.5c0-1.5 1.5-1.7 1.5-3.5M13.5 7.5c0-1.5 1.5-1.7 1.5-3.5"/>`,
  cup: `<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5c0 1.5 1 1.5 1 3M12.5 3.5c0 1.5 1 1.5 1 3"/>`,
  shirt: `<path d="M8.5 3 3 6l2 4.5 2.5-1.2V21h9V9.3l2.5 1.2 2-4.5-5.5-3c-.3 1.8-1.6 3-3.5 3s-3.2-1.2-3.5-3z"/>`,
  shoe: `<path d="M2 18V9h4.5l2 3.5h4l7 2.2a3 3 0 0 1 2.5 3V18zM2 15h20M9.5 12.5v-2M12.5 12.5v-2"/>`,
  gift: `<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C11 6 8 4.2 6.8 5.4S8 9 12 9zM12 9c1-3 4-4.8 5.2-3.6S16 9 12 9z"/>`,
  dumbbell: `<path d="M7 12h10M3 8.5h4v7H3zM17 8.5h4v7h-4zM1.5 10.5v3M22.5 10.5v3"/>`,
  bike: `<circle cx="5.5" cy="16" r="3.8"/><circle cx="18.5" cy="16" r="3.8"/><path d="M5.5 16 9.5 8h6l3 8M9.5 8l3 8H5.5M8 5.5h3.5M15.5 8l1-3H19"/>`,
  "heart-pulse": `<path d="M12 20.5 4 12.7A4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 8 6.3z"/><path d="M3 12.5h4.5l1.5-3 3 6 1.5-3H21"/>`,
  chart: `<path d="M3 3v18h18M7.5 16.5v-4M11.5 16.5v-8M15.5 16.5v-6M19.5 16.5V6"/>`,
  plane: `<path d="M12 2.5c.9 0 1.4 1 1.4 2.4v4.3l7.6 4.6v2l-7.6-2.3v4.8l2.3 1.9v1.3L12 20.6l-3.7.9v-1.3l2.3-1.9v-4.8L3 15.8v-2l7.6-4.6V4.9c0-1.4.5-2.4 1.4-2.4z"/>`,
  suitcase: `<path d="M3 8h18v12H3zM9 8V5.5c0-.6.4-1 1-1h4c.6 0 1 .4 1 1V8M7.5 8v12M16.5 8v12"/>`,
  ticket: `<path d="M3 7h18v3.2a1.8 1.8 0 0 0 0 3.6V17H3v-3.2a1.8 1.8 0 0 0 0-3.6z"/><path d="M14.5 7.5v1.5M14.5 11.2v1.6M14.5 15v1.5"/>`,
  calendar: `<path d="M3 5.5h18V21H3zM3 10h18M8 3v4.5M16 3v4.5M7 14h2M11 14h2M15 14h2M7 17.5h2M11 17.5h2"/>`,
  coin: `<circle cx="12" cy="12" r="9"/><path d="M14.6 9.6c-.5-.9-1.4-1.4-2.6-1.4-1.5 0-2.5.8-2.5 1.9 0 2.6 5.1 1.3 5.1 4 0 1.1-1 2-2.6 2-1.2 0-2.1-.5-2.6-1.4M12 6.5v1.7M12 15.8v1.7"/>`,
  checklist: `<path d="M4.5 3h15v18h-15zM7.5 8l1.5 1.5L12 6.5M7.5 14l1.5 1.5 3-3M14 8.3h3M14 14.3h3"/>`,
  drill: `<path d="M3 5h11.5a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3zM16.5 8H22M7 11l-1.5 9.5h4.8l1.2-9.5M3 8h2"/>`,
  hammer: `<path d="M5 4h9.5L18 6.5V9h-4.5v1.5h-4V9H5zM9.5 10.5h4V20a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1z"/>`,
  wrench: `<path d="M14.8 3.3a5 5 0 0 0-5.2 6.9L3.4 16.4a2.1 2.1 0 0 0 3 3l6.2-6.2a5 5 0 0 0 6.9-5.2l-3 3-2.6-.5-.5-2.6z"/>`,
  ladder: `<path d="M7 2.5v19M17 2.5v19M7 6.5h10M7 10.5h10M7 14.5h10M7 18.5h10"/>`,
  paw: `<path d="M12 12.5c2.6 0 5 2.4 5 4.8 0 1.7-1.3 2.7-2.9 2.7-.9 0-1.4-.4-2.1-.4s-1.2.4-2.1.4C8.3 20 7 19 7 17.3c0-2.4 2.4-4.8 5-4.8z"/><circle cx="5.5" cy="10.5" r="1.8"/><circle cx="9.3" cy="6.3" r="1.8"/><circle cx="14.7" cy="6.3" r="1.8"/><circle cx="18.5" cy="10.5" r="1.8"/>`,
  house: `<path d="M3 11.5 12 3.5l9 8M5 9.8V21h14V9.8M10 21v-6h4v6"/>`,
  key: `<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3M16.5 6.5l2.5 2.5M14 9l2 2"/>`,
  briefcase: `<path d="M3 7.5h18V20H3zM9 7.5v-2c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v2M3 12.5h18M11 11.5v2.5h2v-2.5"/>`,
  newspaper: `<path d="M4 4h13v14.5a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 18.5zM17 8h3v10.5a1.5 1.5 0 0 1-3 0M7 7.5h7M7 11h7M7 14.5h4"/>`,
  book: `<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3M8 7h8"/>`,
  cap: `<path d="m2 9 10-5 10 5-10 5zM6 11v5c2.5 2.3 9.5 2.3 12 0v-5M22 9v6"/>`,
  laptop: `<path d="M4.5 5h15v11h-15zM2 19.5h20"/>`,
  music: `<path d="M9 18V5.5l11-2V16"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>`,
  pin: `<path d="M12 21.5s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  camera: `<path d="M3 8a2 2 0 0 1 2-2h2.5L9 4h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>`,
  leaf: `<path d="M5 19C5 10.5 10 5.2 20 4c-1 10-6 15-15 15zM5 19l8-8"/>`,
  plant: `<path d="M7 14h10l-1.5 7h-7zM12 14V8.5M12 8.5c0-3 2-5 5-5 0 3-2 5-5 5zM12 11c0-2.5-2-4-4.5-4 0 2.5 2 4 4.5 4z"/>`,
  pill: `<path d="M4.6 14.1 14.1 4.6a4.5 4.5 0 0 1 6.4 6.4l-9.5 9.5a4.5 4.5 0 0 1-6.4-6.4zM9.3 9.3l5.4 5.4"/>`,
  car: `<path d="M5 17H3v-5l2.5-5h13l2.5 5v5h-2M9.5 17h5M3 12h18"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/>`,
  phone: `<path d="M8.5 2.5h7a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 6 19V5a2.5 2.5 0 0 1 2.5-2.5zM10.5 18.5h3"/>`,
  star: `<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>`,
  chat: `<path d="M4 5h16v11H9.5L4 20zM8 9h8M8 12.5h5"/>`,
  headset: `<path d="M4 14.5V12a8 8 0 0 1 16 0v2.5M3 14h4v6H3zM17 14h4v6h-4zM19 20c0 1-1 1.5-3 1.5h-2.5"/>`,
  image: `<path d="M3 4h18v16H3z"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m3 17 5-5 4 4 3-3 6 6"/>`,
};

export const PICTOGRAM_IDS: readonly string[] = Object.keys(P);

/** A pictogram as inline SVG, drawn in `currentColor`. An unknown id draws the generic image. */
export function pictogram(id: string, cls = "pg"): string {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[id] ?? P.image}</svg>`;
}

export function hasPictogram(id: string): boolean {
  return id in P;
}
