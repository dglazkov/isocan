import type { TextImage } from "../../core/src/jev.js";
/** Bytes a picture may be read from at all: anything bigger is a title. */
export declare const PICTURE_READ_MAX: number;
/**
 * **A picture made ready to send, or null** — the picture whole when its
 * long side is already within `PICTURE_SIDE`; a PNG over it decoded and
 * box-averaged down to it; anything else over it, or that cannot be read, or
 * too big to send, null (and it goes by its title).
 */
export declare function pictureToSend(bytes: Buffer, mimeType: string): (TextImage & {
    width: number;
    height: number;
}) | null;
