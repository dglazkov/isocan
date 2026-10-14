import type { TextImage } from "../../core/src/jev.js";
/** Bytes a picture may be read from at all: anything bigger is a title. */
export declare const PICTURE_READ_MAX: number;
type Sharp = typeof import("sharp").default;
/** How `sharp` is reached: the real import, or (in a test) one that fails as it does where the package or its binary is absent. */
type ImportSharp = () => Promise<{
    default: Sharp;
}>;
/**
 * **A picture made ready to send, or null** — the picture whole when its
 * long side is already within `PICTURE_SIDE`; over it, scaled down to it by
 * `sharp` when the home has it, else (a PNG only) decoded and box-averaged
 * down here; anything else, or that cannot be read, or too big to send, null
 * (and it goes by its title). `load` is how `sharp` is imported, for a test
 * to make that import fail.
 */
export declare function pictureToSend(bytes: Buffer, mimeType: string, load?: ImportSharp): Promise<(TextImage & {
    width: number;
    height: number;
}) | null>;
export {};
