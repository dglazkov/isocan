/**
 * **What colour a picture actually is under the scrim** (smart contrast
 * phase 3, design §4: "take a look"). `pixels` is RGBA, as a canvas hands
 * them back — the web draws the decoded picture into 16×16 once. Averaged in
 * linear light, because that is the mean an eye sees (an sRGB average of half
 * white and half black is too dark), then composited under black at `scrim`
 * the way the browser blends the scrim element, in sRGB. A transparent pixel
 * is the black the picture is laid on (`--ground-under`).
 *
 * Under today's 0.7 every picture lands `dark` — flat white is
 * `BRIGHTEST_PICTURE` exactly — so this changes nothing anyone sees. It is
 * what makes a lighter scrim for pale pictures a one-number change.
 */
export declare function sampledGround(pixels: Uint8ClampedArray | number[], scrim?: number): string;
