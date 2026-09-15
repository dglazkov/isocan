import type { Ctx } from "./ctx.js";
import type { DesignSystemPort } from "./design-system-reader.js";
/** Node keeps the original source authority on upload and conditional edit, including inherited systems. */
export declare function designSystemPort(ctx: Ctx): DesignSystemPort;
