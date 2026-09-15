import type { Ctx } from "./ctx.js";
import type { DesignRequestReadPort, DesignRequestWritePort } from "./design-request-reader.js";
/** Node keeps existing actor custody, home routing and source policy on every request read/write. */
export declare function designRequestPort(ctx: Ctx): DesignRequestReadPort & DesignRequestWritePort;
